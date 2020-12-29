'use strict';

const {Host} = require('../models/host');
const {SocketServerJson} = require('../models/socket_server_json');
const conf = require('../app').conf;


const socket = new SocketServerJson({
	socketFile: conf.socketFile,
	onData: function(data, clientSocket) {
		let host = Host.lookUp(data['domain']);
		clientSocket.write(JSON.stringify(host || {host: 'none'}));
		if(host){
			try{
				Host.addCache(data['domain'], host)
			}catch(error){
				console.error('Should never get this error...', error)
			}
		}
	},
	onListen: function(){
		console.log('listening')
	}
});
