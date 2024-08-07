'use strict';

const {Host} = require('../models/host');
const {SocketServerJson} = require('../models/socket_server_json');
const conf = require('../conf');


const socket = new SocketServerJson({
	socketFile: conf.socketFile,
	onData: function(data, clientSocket) {
		try{
			let parentHost = Host.lookUp(data['domain'])  || {host: 'none'};
			if(!parentHost.wildcard_parent){
				parentHost.wildcard_parent = parentHost.host;
				Host.addCache(data['domain'], parentHost);
			}

			for(const [key, value] of Object.entries(parentHost)) {
				parentHost[key] = String(value);
			};

			clientSocket.write(JSON.stringify(parentHost));
		}catch(error){
			console.error('controler/hosts onData error', error)
		}
	},
	onListen: function(){
		console.log('Unix socket listening on', conf.socketFile)
	}
});
