'use strict';

const {promisify} = require('util');
const client = require('../redis');

async function getInfo(data){
	let info = await client.HGETALL('host_' + data.host);

	return info
}


async function listAll(){
	try{
		let hosts = await client.SMEMBERS('hosts');
		return hosts;
	}catch(error){
		return new Error(error);
	}
}


async function add(data){
	try{
		await client.SADD('hosts', data.host);
		await client.HSET('host_' + data.host, 'ip', data.ip);
		await client.HSET('host_' + data.host, 'updated', (new Date).getTime());
		await client.HSET('host_' + data.host, 'username', data.username);
		await client.HSET('host_' + data.host, 'force_ssl', data.forceSSL || 'false');
	} catch (error){
		
		return new Error(error);

	}
}


async function remove(data){
	try{
		await client.SREM('hosts', data.host);
		let count = await client.DEL('host_' + data.host);
		return count;
	} catch(error) {
		return new Error(error);
	}
}


module.exports = {getInfo, listAll, add, remove};
