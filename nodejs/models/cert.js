'use strict';

const {createClient} = require('redis');
const client = createClient({});

client.connect();

async function getCert(host){
	try{
		console.log('looking for', host);
		return JSON.parse(await client.GET(`${host}:latest`));
	}catch(error){
		return {}
	}
}

async function setCert(host, cert){
	try{
		return await client.SET(`${host}:latest`, JSON.stringify(cert));
	}catch(error){
		return {}
	}
}

async function deleteCert(host){
	try{
		console.log('looking for', host);
		return JSON.parse(await client.DEL(`${host}:latest`));
	}catch(error){
		return {}
	}
}

module.exports = {getCert, setCert, deleteCert};
