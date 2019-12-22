'use strict';

const {promisify} = require('util');
const client = require('../utils/redis');
const {processKeys, ObjectValidateError} = require('../utils/object_validate');

const hostKeysMap = {
	'host': {isRequired: true, type: 'string', min: 3, max: 500},
	'ip': {isRequired: true, type: 'string', min: 3, max: 500},
	'updated': {default: function(){return (new Date).getTime()}, always: true},
	'username': {isRequired: true, type: 'string', always: true},
	'targetport': {isRequired: true, type: 'number', min:0, max:65535},
	'forcessl': {isRequired: false, default: true, type: 'boolean'},
	'targetssl': {isRequired: false, default: false, type: 'boolean'},
}

async function getInfo(data){
	try{
		let info = await client.HGETALL('host_' + data.host);

		if(info){
			info['host'] = data.host;

			return info
		}

	}catch(error){
		throw error
	}

	let error = new Error('HostNotFound');
	error.name = 'HostNotFound';
	error.message = 'Host does not exists';
	error.status = 404;
	throw error;
}

async function exists(host){
	try{
		await getInfo({host})
		return true
	}catch(error){
		return false;
	}
}

async function listAll(){
	try{
		let hosts = await client.SMEMBERS('hosts');
		return hosts;
	}catch(error){
		throw error;
	}
}

async function listAllDetail(){
	let out = [];

	for(let host of await listAll()){
		out.push(await getInfo({host}));
	}

	return out
}

async function add(data, edit){
	try{
		data = processKeys(hostKeysMap, data, edit);

		if(data.host && await exists(data.host)){
			let error = new Error('HostNameUsed');
			error.name = 'HostNameUsed';
			error.message = 'Host already exists';
			error.status = 409;
			throw error;
		}else if(data.host){
			await client.SADD('hosts', data.host);
		}

		for(let key of Object.keys(data)){
			await client.HSET('host_' + data.host, key, data[key]);
		}

		return true;
	} catch(error){
		throw error
	}
}

async function edit(data, host){
	try{

		// Get the current host and trow a 404 if it doesnt exist.
		let hostData = await getInfo({host});

		// Check to see if host name changed
		if(data.host && data.host !== host){

			// Merge the current data into with the updated data 
			data = Object.assign({}, hostData, data);

			// Create a new record for the updated host. If that succeeds,
			// delete the old recored
			if(await add(hostData)) await remove({host}); 

		}else{
			// Update what ever fields that where passed.

			// Validate the passed data, ignoring required fields.
			data = processKeys(hostKeysMap, data, true);
			
			// Loop over the data fields and apply them to redis
			for(let key of Object.keys(data)){
				await client.HSET('host_' + host, key, data[key]);
			}
		}
	} catch(error){
		// Pass any error to the calling function
		throw error;
	}
}

async function remove(data){
	try{
		await getInfo(data);

		await client.SREM('hosts', data.host);
		let count = await client.DEL('host_' + data.host);

		for(let key of Object.keys(hostKeysMap)){
			await client.HDEL('host_' + data.host, key);
		}
		return count;
	} catch(error) {
		throw error;
	}
}


module.exports = {getInfo, listAll, listAllDetail, add, edit, remove};
