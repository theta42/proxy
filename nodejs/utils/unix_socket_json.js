'use strict';

const net = require('net');
const fs = require('fs');
const {CallbackQueue} = require('../utils/callback_queue');

/**
 * SocketServerJson
 *
 * A generic Unix socket server that handles JSON message communication.
 * Automatically manages socket file lifecycle (cleanup, permissions).
 * Uses callback queues for event handling to support multiple listeners.
 *
 * Features:
 * - Automatic socket file cleanup on startup
 * - Configurable file permissions (default 777 for container use)
 * - JSON message parsing with buffering for partial data
 * - Event callbacks for data, errors, and connection lifecycle
 */
class SocketServerJson {
	constructor(args){
		this.socketFile = args.socketFile;
		this.onData = new CallbackQueue(args.onData, this);
		this.onListen = new CallbackQueue(args.onListen, this);
		this.onError = new CallbackQueue(args.onError);
		this.onClientNew = new CallbackQueue(args.onClientNew);
		this.onClientClose = new CallbackQueue(args.onClientClose);
		this.onClientError = new CallbackQueue(args.onClientError);

		// Set socket file permissions after listening
		// 777 is acceptable here for single-use container environments
		this.onListen.push(function(){
			fs.chmodSync(args.socketFile, '777');
		});

		this.listen();
	}

	/**
	 * Removes existing socket file if present before creating new server.
	 * Prevents "address already in use" errors from stale socket files.
	 */
	__resetSocketFile(callback){
		let instance = this;

		fs.stat(this.socketFile, function (err, stats) {
			if (stats) {
				fs.unlink(instance.socketFile, function(err){
					if(err){
						// This should never happen
						console.error(err);
					}
					callback(...arguments);
				});
			}else{
				callback();
			}
		});
	}

	/**
	 * Sets up the Unix socket server and registers event handlers.
	 *
	 * Data handling:
	 * - Buffers incoming data to handle partial JSON messages
	 * - Attempts to parse buffer as JSON after each data event
	 * - Clears buffer only after successful parse
	 * - Silent failure on parse errors (waits for more data)
	 */
	__setUpServer(){
		let instance = this;
		this.socket = net.createServer();

		this.socket.on('connection', function(clientSocket){
			let buffer = '';

			clientSocket.on('data', function(data){
				buffer += data.toString();
				try{
					// Parse buffer (not just current data chunk) to handle partial messages
					instance.onData.call(JSON.parse(buffer), clientSocket);
					buffer = '';
				}catch(error){
					// Parse failed - likely incomplete JSON, wait for more data
					// Buffer persists until complete JSON is received
				}
			});

			clientSocket.on('close', instance.onClientClose.call.bind(instance.onClientClose));

			clientSocket.on('error', instance.onClientError.call.bind(instance.onClientError));
		});

		this.socket.on('error', this.onError.call.bind(this.onError));

		this.socket.on('listening', this.onListen.call.bind(this.onListen));
	}

	/**
	 * Starts the Unix socket server.
	 * Cleans up any existing socket file before listening.
	 */
	listen(){
		let instance = this;

		this.__setUpServer();

		this.__resetSocketFile(function(){
			instance.socket.listen(instance.socketFile);
		});
	}
}

module.exports = {SocketServerJson};
