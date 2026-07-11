-- Per-host reverse-proxy controls, enforced from the shared location's Lua
-- phases. The Host record (a Redis hash) is resolved by targetinfo.lua and
-- passed in here as `res`; targetinfo also stashes it in ngx.ctx.targetInfo so
-- the header-filter phase can re-read it.
--
-- Fields consumed (see nodejs/models/host.js):
--   ratelimit_enabled / ratelimit_rate / ratelimit_burst
--   respcache_enabled
--   hsts_enabled
--   req_headers  (JSON object)  -- added to the upstream request
--   resp_headers (JSON object)  -- added to the client response
--   ip_allow / ip_deny (JSON arrays of CIDRs)
--   basicauth_enabled / basicauth_realm
--   basicauth_users (JSON object {username: base64(sha1(password))})
--   sso_enabled  -- gate on a __proxy_sso session (established by /__proxy_auth)

local cjson = require "cjson.safe"

local M = {}

-- cjson.safe returns nil (not an error) on bad input; treat non-tables as empty.
local function decode_table(str)
    if not str or str == "" then return nil end
    local ok = cjson.decode(str)
    if type(ok) == "table" then return ok end
    return nil
end

-- resty.ipmatcher wants a plain array of CIDR strings; build a matcher or nil.
local function build_matcher(str)
    local list = decode_table(str)
    if not list or #list == 0 then return nil end

    local ipmatcher = require "resty.ipmatcher"
    local m, err = ipmatcher.new(list)
    if not m then
        ngx.log(ngx.ERR, "hostfeatures: bad ip list ", err)
        return nil
    end
    return m
end

-- IP allow/deny. deny wins; a non-empty allow list is default-deny.
local function apply_ip_access(res, ip)
    local deny = build_matcher(res["ip_deny"])
    if deny and deny:match(ip) then
        return ngx.exit(403)
    end

    local allow = build_matcher(res["ip_allow"])
    if allow and not allow:match(ip) then
        return ngx.exit(403)
    end
end

-- Per-host, per-client token bucket via lua-resty-limit-traffic (bundled with
-- OpenResty). Uses the shared dict "ratelimit" declared in nginx.conf.
local function apply_ratelimit(res, host, ip)
    if res["ratelimit_enabled"] ~= "true" then return end

    local rate = tonumber(res["ratelimit_rate"]) or 10
    local burst = tonumber(res["ratelimit_burst"]) or 0

    local limit_req = require "resty.limit.req"
    local lim, err = limit_req.new("ratelimit", rate, burst)
    if not lim then
        -- Fail open on a misconfigured limiter rather than 500 every request.
        ngx.log(ngx.ERR, "hostfeatures: failed to make limiter ", err)
        return
    end

    local delay, derr = lim:incoming(host .. ":" .. ip, true)
    if not delay then
        if derr == "rejected" then
            return ngx.exit(429)
        end
        ngx.log(ngx.ERR, "hostfeatures: limiter error ", derr)
        return
    end

    if delay > 0 then
        ngx.sleep(delay)
    end
end

-- ---- Per-host authentication (basic auth OR SSO) -----------------------
--
-- Both are optional. If either is enabled, a request must satisfy at least one.
-- A "Basic" Authorization header routes to the basic-auth path (401 challenge on
-- failure); otherwise a browser is redirected into the SSO login. Basic-auth
-- creds are stored as {user: base64(sha1(pw))} (htpasswd "{SHA}"; hashed in
-- nodejs). SSO relies on a Redis-backed session established by /__proxy_auth
-- (nodejs); the allow-list was enforced there, so here we only confirm a valid
-- session for this host.

-- True when the request carries valid basic-auth credentials for this host.
local function basic_auth_ok(res)
    local users = decode_table(res["basicauth_users"])
    if not users then return false end

    local header = ngx.var.http_authorization
    if not header then return false end
    local b64 = header:match("^%s*[Bb]asic%s+(%S+)%s*$")
    if not b64 then return false end

    local decoded = ngx.decode_base64(b64)
    if not decoded then return false end
    local user, pass = decoded:match("^([^:]*):(.*)$")
    if not user or user == "" then return false end

    local stored = users[user]
    if not stored then return false end

    local sha1 = require "resty.sha1"
    local hasher = sha1:new()
    if not hasher then return false end
    hasher:update(pass or "")
    return ngx.encode_base64(hasher:final()) == stored
end

local function basic_challenge(res)
    local realm = res["basicauth_realm"]
    if not realm or realm == "" then realm = "Restricted" end
    realm = realm:gsub('[\r\n"]', "")   -- defense in depth for the header
    ngx.header["WWW-Authenticate"] = 'Basic realm="' .. realm .. '"'
    return ngx.exit(401)
end

-- Read an SSO session hash from Redis. Returns the table or nil. The sid comes
-- from a cookie (attacker-controlled), so it is character-restricted before use.
local function sso_get_session(sid)
    if not sid or not sid:match("^[%w_%-]+$") then return nil end

    local redis = require "resty.redis"
    local red = redis:new()
    red:set_timeout(1000)
    local ok, err = red:connect("127.0.0.1", 6379)
    if not ok then
        ngx.log(ngx.ERR, "hostfeatures: sso redis connect ", err)
        return nil
    end

    local arr = red:hgetall("proxy_SsoSession_" .. sid)
    local sess = arr and red:array_to_hash(arr) or nil
    red:set_keepalive(10000, 100)

    if sess and next(sess) ~= nil then return sess end
    return nil
end

-- True when a valid SSO session cookie exists for THIS host. (The session
-- auto-expires via Redis TTL; a missing key reads as no session.)
local function sso_session_ok()
    local sid = ngx.var.cookie___proxy_sso
    if not sid or sid == "" then return false end
    local sess = sso_get_session(sid)
    if not sess or not sess["sub"] then return false end
    if sess["host"] ~= ngx.var.host then return false end
    return true
end

-- Send a browser into the SSO login, preserving where it was headed. Non-idempotent
-- methods get a 401 instead of a redirect they couldn't safely replay.
local function sso_redirect()
    local m = ngx.req.get_method()
    if m ~= "GET" and m ~= "HEAD" then
        return ngx.exit(401)
    end
    local rd = ngx.var.scheme .. "://" .. ngx.var.host .. ngx.var.request_uri
    return ngx.redirect("/__proxy_auth/start?rd=" .. ngx.escape_uri(rd), 302)
end

-- Enforce whichever auth methods are enabled; allow if EITHER passes.
local function apply_auth(res)
    local basic_on = res["basicauth_enabled"] == "true"
    local sso_on = res["sso_enabled"] == "true"
    if not basic_on and not sso_on then return end

    if basic_on and basic_auth_ok(res) then return end
    if sso_on and sso_session_ok() then return end

    -- Not authenticated. Pick the right challenge for the client.
    local auth = ngx.var.http_authorization
    local has_basic_header = auth and auth:match("^%s*[Bb]asic%s") ~= nil

    if sso_on and not has_basic_header then
        return sso_redirect()
    end
    if basic_on then
        return basic_challenge(res)
    end
    return sso_redirect()
end

-- Extra request headers sent to the upstream.
local function apply_req_headers(res)
    local headers = decode_table(res["req_headers"])
    if not headers then return end
    for name, value in pairs(headers) do
        ngx.req.set_header(name, value)
    end
end

-- access_by_lua entry point. Runs after targetinfo.get resolved `res`.
function M.access(ngx_, res)
    if not res then return end
    local ip = ngx.var.remote_addr
    local host = ngx.var.host

    apply_ip_access(res, ip)
    apply_ratelimit(res, host, ip)
    apply_auth(res)
    apply_req_headers(res)

    -- Cache gate for proxy_no_cache / proxy_cache_bypass. Opt-in per host.
    ngx.var.skip_cache = (res["respcache_enabled"] == "true") and "0" or "1"
end

-- header_filter_by_lua entry point. Reads the record stashed in ngx.ctx.
function M.header(ngx_)
    local res = ngx.ctx.targetInfo
    if not res then return end

    local headers = decode_table(res["resp_headers"])
    if headers then
        for name, value in pairs(headers) do
            ngx.header[name] = value
        end
    end

    if res["hsts_enabled"] == "true" then
        ngx.header["Strict-Transport-Security"] =
            "max-age=31536000; includeSubDomains"
    end
end

return M
