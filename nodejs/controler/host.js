'use strict';

const {Host} = require('../models/host');
const {SocketServerJson} = require('../models/socket_server_json');
const conf = require('../app').conf;


const socket = new SocketServerJson({
	socketFile: conf.socketFile,
	onData: function(data, clientSocket) {
		clientSocket.write(JSON.stringify(Host.lookUp(data['domain']) || {host: 'none'}));
	},
	onListen: function(){
		console.log('listening')
	}
});
