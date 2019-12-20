'use strict';

const {promisify} = require('util');
const client = require('../redis');

async function getInfo(data){
	let info = await client.HGETALL('host_' + data.host);
	info['host'] = data.host;

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
	let out = [];

	for(let host of await listAll()){
		out.push(await getInfo({host}));
	}

	return out
}


async function add(data){


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
