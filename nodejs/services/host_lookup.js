'use strict';

const {Host} = require('../models/host');
const {SocketServerJson} = require('../utils/unix_socket_json');
const conf = require('@simpleworkjs/conf');

/**
 * Host Lookup Service
 *
 * Unix socket server that handles host/domain lookup requests from OpenResty.
 * This provides the bridge between nginx (Lua) and the Node.js host management system.
 *
 * Flow:
 * 1. OpenResty sends domain lookup request via Unix socket
 * 2. Service queries Host model (supports wildcards via lookup tree)
 * 3. Returns host configuration (IP, port, SSL settings, etc.)
 * 4. All values converted to strings for Redis compatibility
 *
 * Redis Compatibility:
 * All object values are converted to strings before sending because:
 * - Redis stores everything as strings
 * - OpenResty's primary lookup path uses Redis directly (hgetall)
 * - This socket is a fallback when Redis cache misses
 * - Both paths must return identical data structures to Lua consumer
 */

const socket = new SocketServerJson({
	socketFile: conf.socketFile,

	onData: function(data, clientSocket) {
		try{
			// Try to match the requested host name using the lookup tree
			let parentHost = Host.lookUp(data['domain']);

			// If we don't have a match, return empty object
			if(!parentHost) return clientSocket.write(JSON.stringify({}));

			// If the matched host belongs to a wildcard domain, set wildcard_parent
			// This allows child domains to use the parent's wildcard SSL certificate
			if(!parentHost.wildcard_parent){
				parentHost.wildcard_parent = parentHost.host;
				Host.addCache(data['domain'], parentHost);
			}

			// Convert all values to strings for Redis compatibility
			// OpenResty expects the same data format from both Redis and this socket
			for(const [key, value] of Object.entries(parentHost)) {
				parentHost[key] = String(value);
			}

			clientSocket.write(JSON.stringify(parentHost));
		}catch(error){
			console.error('services/host_lookup onData error', error);
		}
	},

	onListen: function(){
		console.log('Host lookup service listening on', conf.socketFile);
	}
});

module.exports = {socket};
