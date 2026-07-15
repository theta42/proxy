local M = {}

-- Query the Node app's host-lookup service for a domain that missed the
-- Redis fast path (wildcard subdomains not yet cached, see Host.addCache).
-- Uses an OpenResty cosocket rather than the classic LuaSocket socket.unix()
-- the previous version of this file used: LuaSocket's API is blocking and,
-- called from an nginx worker, stalls the ENTIRE worker (every other
-- in-flight connection on it) for the round-trip -- a real source of
-- intermittent request latency for any wildcard host whose on-demand cache
-- entry (1h TTL, conf.cacheTTL) had expired. resty.redis (used just above)
-- is cosocket-based already and works fine from both the phases this module
-- is called from (access_by_lua_block and the SSL request_domain callback),
-- so a unix-domain cosocket is safe here too.
local function unixLookup(json, domain)
    -- The ngx_lua cosocket API has no separate ngx.socket.unix -- a plain
    -- ngx.socket.tcp() connects to a unix domain socket when given a
    -- "unix:/path" address instead of a host/port pair.
    local sock = ngx.socket.tcp()
    sock:settimeouts(100, 100, 100) -- connect, send, read (ms)

    local ok = sock:connect("unix:/var/run/proxy_lookup.socket")
    if not ok then return nil end

    local ok = sock:send(json.encode({domain = domain}))
    if not ok then
        sock:close()
        return nil
    end

    local line = sock:receive()
    sock:close()
    if not line then return nil end

    local decodeOk, decoded = pcall(json.decode, line)
    if not decodeOk then return nil end
    return decoded
end

print("In targetInfo module")

-- Main function of the module. Returns (res) on success, or (nil, httpStatus)
-- on failure -- it must NOT call ngx.exit() itself: this is called both from
-- proxy.conf's access_by_lua_block (a normal request phase, where ngx.exit()
-- is fine) AND from nginx.conf's request_domain callback, which runs during
-- the TLS handshake (ssl_certificate_by_lua*). ngx.exit() is not a supported
-- API in that phase -- calling it there aborts the handshake with a bare
-- "internal error" TLS alert and no log output, breaking TLS entirely
-- (including the self-signed fallback cert, since auto-ssl never gets to
-- fall back gracefully). Callers that can legitimately abort the request
-- (i.e. proxy.conf) must call ngx.exit() themselves using the returned status.
function M.get(ngx, domain, targetInfo)
    -- Reuse a previously-resolved target ONLY when it was resolved for this
    -- exact host. HTTP/2 connection coalescing lets a browser serve several
    -- hostnames that share one wildcard cert (e.g. *.718it.biz) over a single
    -- connection; the SSL phase (request_domain) resolves and caches the
    -- connection's first host in ngx.ctx.targetInfo. Without the domain check
    -- below, every coalesced request on that connection would be handed the
    -- first host's target -- e.g. hassio.718it.biz served from metrics.718it.biz.
    if targetInfo and ngx.ctx.targetInfo_domain == domain then
        return targetInfo
    end

    local json = require "cjson"
    local redis = require "resty.redis"

    if not domain then
        return nil, 499
    end

    local red = redis:new()
    red:set_timeout(1000) -- 1 second

    local ok, err = red:connect("127.0.0.1", 6379)
    if not ok then
        ngx.log(ngx.ERR, "failed to connect to redis: ", err)
        return nil, 598
    end

    local res, err = red:hgetall("proxy_Host_"..domain)
    res = red:array_to_hash(res)

    -- Return the connection to the pool instead of closing it, so it can be
    -- reused by later requests. Without this a new connection is opened per
    -- request and never released, exhausting sockets under load.
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "failed to set redis keepalive: ", err)
    end

    if not res["ip"] then
        res = unixLookup(json, domain) or res
    end

    if not res["ip"] then
        return nil, 406
    end

    ngx.ctx.targetInfo = res
    -- Remember which host this target was resolved for, so the reuse guard at
    -- the top can tell a genuine cache hit from a coalesced request for a
    -- different host on the same connection.
    ngx.ctx.targetInfo_domain = domain
    ngx.ctx.toAllow = true

    return res
end

return M
