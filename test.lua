local socket = assert(require "socket.unix"())
local function connect(path)
	assert(socket:settimeout(.05))
	local status,err = pcall(function() assert(socket:connect(path)) end)	
	if status then return true end
	io.stderr:write(err.." ("..path..")\n")
	return false
end

local json = require "lunajson"
local res

if connect("/var/run/proxy_lookup.socket") then 
	host = "payments.blah.com"

	assert(socket:send(json.encode({domain = host})))
	while 1 do
		local s, status, partial = socket:receive()
		if partial then
			res = json.decode(partial)
			break
		end
	end
end


print(res['ip'])



