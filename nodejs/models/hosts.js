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


async function listAllDetail(){
	try{
		let out = [];
		let hosts = await listAll();

		for(let host of hosts){
			out.push(await getInfo({host}));
		}

		return out
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
		await client.HSET('host_' + data.host, 'targetPort', data.targetPort);
		if(data.forceSSL !== undefined){
			await client.HSET('host_' + data.host, 'forcessl', !!data.forceSSL);
		}
		if(data.targetSSL !== undefined){
			await client.HSET('host_' + data.host, 'targetssl', !!data.targetSSL);
		}
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


module.exports = {getInfo, listAll, listAllDetail, add, remove};
