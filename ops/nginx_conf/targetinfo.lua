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

-- Main function of the module
function M.get(ngx, domain, targetInfo)
    if targetInfo then
        return targetInfo
    end

    local json = require "cjson"
    local redis = require "resty.redis"
    
    if not domain then
        ngx.exit(499)
        return false
    end

    local red = redis:new()
    red:set_timeout(1000) -- 1 second

    local ok, err = red:connect("127.0.0.1", 6379)
    if not ok then
        ngx.log(ngx.ERR, "failed to connect to redis: ", err)
        return ngx.exit(598)
    end

    local res, err = red:hgetall("proxy_Host_"..domain)
    res = red:array_to_hash(res)

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
        ngx.exit(406)
        return false
    end

    ngx.ctx.targetInfo = res
    ngx.ctx.toAllow = true

    return res
end

return M
