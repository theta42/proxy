'use strict';

const {Host} = require('../models/host');
const {SocketServerJson} = require('../models/socket_server_json');
const conf = require('../app').conf;


const socket = new SocketServerJson({
	socketFile: conf.socketFile,
	onData: function(data, clientSocket) {
		try{
			console.log('socket lookup for', data)
			let parentHost = Host.lookUp(data['domain'])  || {host: 'none'};
			console.log('found', parentHost)
			if(!parentHost.wildcard_parent){
				parentHost.wildcard_parent = parentHost.host;
				Host.addCache(data['domain'], parentHost);
			}

			for(const [key, value] of Object.entries(parentHost)) {
				parentHost[key] = String(value);
			};


			console.log('To send socket', JSON.stringify(parentHost))

			clientSocket.write(JSON.stringify(parentHost));
		}catch(error){
			console.error('controler/hosts onData error', error)
		}

	},
	onListen: function(){
		console.log('listening')
	}
});
