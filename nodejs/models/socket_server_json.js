'use strict';

const net = require('net');
const fs = require('fs');
const {CallbackQueue} = require('../utils/callback_queue')

class SocketServerJson {
	constructor(args){
		this.socketFile = args.socketFile;
		this.onData = new CallbackQueue(args.onData, this);
		this.onListen = new CallbackQueue(args.onListen, this);
		this.onError = new CallbackQueue(args.onError);
		this.onCLientNew = new CallbackQueue(args.onCLientNew);
		this.onCLientClose = new CallbackQueue(args.onCLientClose);
		this.onCLientError = new CallbackQueue(args.onCLientClose);

		this.onListen.push(function(){
			fs.chmodSync(args.socketFile, '777');
		})

		this.listen();

	}

	__resetSocketFile(callback){
		let instance = this;

		fs.stat(this.socketFile, function (err, stats) {
			if (stats) {
				fs.unlink(instance.socketFile, function(err){
					if(err){
						// This should never happen.
						console.error(err);
					}
					callback(...arguments)
				});
			}else{
				callback()
			}

		});
	}


	__setUpServer(){

		let instance = this;
		this.socket = net.createServer();

		this.socket.on('connection', function(clientSocket){
			let buffer = '';

			clientSocket.on('data', function(data){
				buffer += data.toString();
				try{
					console.log('buffer', buffer)
					instance.onData.call(JSON.parse(data), clientSocket)
					buffer = ''
					// clientSocket.write(JSON.stringify(Host.lookUp(buffer)|| {host: 'none'}));

				}catch(error){
					;
				}
			});

			clientSocket.on('close', instance.onCLientClose.call.bind(instance.onCLientClose));

			clientSocket.on('error', instance.onCLientError.call.bind(instance.onCLientError));

		});

		this.socket.on('error', this.onError.call.bind(this.onError))

		this.socket.on('listening', this.onListen.call.bind(this.onListen));
	}

	listen(){
		let instance = this;

		this.__setUpServer();

		this.__resetSocketFile(function(){
			instance.socket.listen(instance.socketFile);
		});

	}
};

module.exports = {SocketServerJson};
