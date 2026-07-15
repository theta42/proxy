local M = {}

-- Function to connect to a Unix socket
local function connect(path)
    local socket = require("socket.unix")()
    assert(socket:settimeout(.1))
    local status, err = pcall(function() assert(socket:connect(path)) end)
    if status then return true end
    return false
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
        if connect("/var/run/proxy_lookup.socket") then
            local socket = require("socket.unix")()
            assert(socket:settimeout(.1))
            assert(socket:connect("/var/run/proxy_lookup.socket"))
            assert(socket:send(json.encode({domain = domain})))
            while true do
                local s, status, partial = socket:receive()
                if partial then
                    res = json.decode(partial)
                    socket:close()
                    break
                end
            end
        end
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
