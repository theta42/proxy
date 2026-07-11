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
