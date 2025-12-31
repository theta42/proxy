'use strict';

const {describe, test, after} = require('node:test');
const assert = require('node:assert');
const net = require('net');
const fs = require('fs');
const path = require('path');
const {SocketServerJson} = require('../../utils/unix_socket_json');

/**
 * Tests for Unix Socket JSON Server
 *
 * Tests the socket server's ability to:
 * - Accept connections on Unix socket
 * - Parse complete JSON messages
 * - Handle partial JSON data (buffering)
 * - Trigger callbacks correctly
 * - Clean up socket files
 */

describe('Unix Socket JSON Server', () => {

	// Use a test-specific socket file
	const testSocketFile = path.join('/tmp', `test-socket-${Date.now()}.sock`);
	let activeServers = [];

	after(() => {
		// Cleanup: close all servers and remove socket files
		activeServers.forEach(server => {
			try {
				if(server.socket) server.socket.close();
			} catch(e) {}
		});

		try {
			if(fs.existsSync(testSocketFile)) {
				fs.unlinkSync(testSocketFile);
			}
		} catch(e) {}
	});

	test('should create and listen on Unix socket', (t, done) => {
		const server = new SocketServerJson({
			socketFile: testSocketFile,
			onListen: () => {
				assert.ok(fs.existsSync(testSocketFile), 'Socket file should exist');
				server.socket.close();
				done();
			}
		});
		activeServers.push(server);
	});

	test('should parse complete JSON message', (t, done) => {
		const testData = {message: 'hello', value: 123};
		let receivedData = null;

		const server = new SocketServerJson({
			socketFile: testSocketFile + '-json',
			onData: (data, clientSocket) => {
				receivedData = data;
				clientSocket.end();
			},
			onListen: () => {
				// Connect and send JSON
				const client = net.createConnection(testSocketFile + '-json', () => {
					client.write(JSON.stringify(testData));
				});

				client.on('close', () => {
					assert.deepStrictEqual(receivedData, testData);
					server.socket.close();
					try {
						if(fs.existsSync(testSocketFile + '-json')) {
							fs.unlinkSync(testSocketFile + '-json');
						}
					} catch(e) {}
					done();
				});
			}
		});
		activeServers.push(server);
	});

	test('should handle partial JSON data', (t, done) => {
		const testData = {message: 'hello world', value: 456, nested: {foo: 'bar'}};
		const jsonString = JSON.stringify(testData);
		let receivedData = null;

		const server = new SocketServerJson({
			socketFile: testSocketFile + '-partial',
			onData: (data, clientSocket) => {
				receivedData = data;
				clientSocket.end();
			},
			onListen: () => {
				const client = net.createConnection(testSocketFile + '-partial', () => {
					// Send JSON in chunks to simulate partial data
					const chunk1 = jsonString.slice(0, 10);
					const chunk2 = jsonString.slice(10);

					client.write(chunk1);

					// Wait a bit then send the rest
					setTimeout(() => {
						client.write(chunk2);
					}, 10);
				});

				client.on('close', () => {
					assert.deepStrictEqual(receivedData, testData);
					server.socket.close();
					try {
						if(fs.existsSync(testSocketFile + '-partial')) {
							fs.unlinkSync(testSocketFile + '-partial');
						}
					} catch(e) {}
					done();
				});
			}
		});
		activeServers.push(server);
	});

	test('should call multiple onData callbacks', (t, done) => {
		const testData = {test: 'data'};
		const callbackResults = [];

		const server = new SocketServerJson({
			socketFile: testSocketFile + '-multi',
			onData: [
				(data) => callbackResults.push('callback1'),
				(data) => callbackResults.push('callback2'),
			],
			onListen: () => {
				const client = net.createConnection(testSocketFile + '-multi', () => {
					client.write(JSON.stringify(testData));
					client.end();
				});

				client.on('close', () => {
					assert.strictEqual(callbackResults.length, 2);
					assert.strictEqual(callbackResults[0], 'callback1');
					assert.strictEqual(callbackResults[1], 'callback2');
					server.socket.close();
					try {
						if(fs.existsSync(testSocketFile + '-multi')) {
							fs.unlinkSync(testSocketFile + '-multi');
						}
					} catch(e) {}
					done();
				});
			}
		});
		activeServers.push(server);
	});

	test('should provide client socket to callbacks', (t, done) => {
		const testData = {request: 'test'};
		const responseData = {response: 'success'};
		let receivedResponse = '';

		const server = new SocketServerJson({
			socketFile: testSocketFile + '-response',
			onData: (data, clientSocket) => {
				// Echo back a response
				clientSocket.write(JSON.stringify(responseData));
				clientSocket.end();
			},
			onListen: () => {
				const client = net.createConnection(testSocketFile + '-response', () => {
					client.write(JSON.stringify(testData));
				});

				client.on('data', (data) => {
					receivedResponse += data.toString();
				});

				client.on('close', () => {
					assert.deepStrictEqual(JSON.parse(receivedResponse), responseData);
					server.socket.close();
					try {
						if(fs.existsSync(testSocketFile + '-response')) {
							fs.unlinkSync(testSocketFile + '-response');
						}
					} catch(e) {}
					done();
				});
			}
		});
		activeServers.push(server);
	});

	test('should clean up existing socket file on startup', (t, done) => {
		const socketPath = testSocketFile + '-cleanup';

		// Create a stale socket file
		fs.writeFileSync(socketPath, 'stale');

		const server = new SocketServerJson({
			socketFile: socketPath,
			onListen: () => {
				// Should have removed the old file and created a new socket
				assert.ok(fs.existsSync(socketPath));
				const stats = fs.statSync(socketPath);
				assert.ok(stats.isSocket(), 'Should be a socket, not a regular file');
				server.socket.close();
				try {
					if(fs.existsSync(socketPath)) {
						fs.unlinkSync(socketPath);
					}
				} catch(e) {}
				done();
			}
		});
		activeServers.push(server);
	});

	test('should handle multiple sequential messages', (t, done) => {
		const messages = [
			{id: 1, text: 'first'},
			{id: 2, text: 'second'},
			{id: 3, text: 'third'}
		];
		const receivedMessages = [];

		const server = new SocketServerJson({
			socketFile: testSocketFile + '-sequential',
			onData: (data, clientSocket) => {
				receivedMessages.push(data);
				if(receivedMessages.length === messages.length) {
					clientSocket.end();
				}
			},
			onListen: () => {
				const client = net.createConnection(testSocketFile + '-sequential', () => {
					// Send messages with delays to simulate separate events
					messages.forEach((msg, index) => {
						setTimeout(() => {
							client.write(JSON.stringify(msg));
						}, index * 10);
					});
				});

				client.on('close', () => {
					assert.strictEqual(receivedMessages.length, messages.length);
					assert.deepStrictEqual(receivedMessages[0], messages[0]);
					assert.deepStrictEqual(receivedMessages[1], messages[1]);
					assert.deepStrictEqual(receivedMessages[2], messages[2]);
					server.socket.close();
					try {
						if(fs.existsSync(testSocketFile + '-sequential')) {
							fs.unlinkSync(testSocketFile + '-sequential');
						}
					} catch(e) {}
					done();
				});
			}
		});
		activeServers.push(server);
	});

	test('should buffer data and parse when complete JSON received', (t, done) => {
		// This test verifies the buffer accumulates until valid JSON is formed
		// Note: Once malformed JSON enters buffer, it cannot recover
		const testData = {test: 'buffering', value: 999};
		const jsonString = JSON.stringify(testData);
		let receivedData = null;

		const server = new SocketServerJson({
			socketFile: testSocketFile + '-buffer',
			onData: (data, clientSocket) => {
				receivedData = data;
				clientSocket.end();
			},
			onListen: () => {
				const client = net.createConnection(testSocketFile + '-buffer', () => {
					// Send in three parts to test buffering
					const part1 = jsonString.slice(0, 8);
					const part2 = jsonString.slice(8, 16);
					const part3 = jsonString.slice(16);

					client.write(part1);
					setTimeout(() => {
						client.write(part2);
						setTimeout(() => {
							client.write(part3);
						}, 5);
					}, 5);
				});

				client.on('close', () => {
					assert.deepStrictEqual(receivedData, testData);
					server.socket.close();
					try {
						if(fs.existsSync(testSocketFile + '-buffer')) {
							fs.unlinkSync(testSocketFile + '-buffer');
						}
					} catch(e) {}
					done();
				});
			}
		});
		activeServers.push(server);
	});
});
