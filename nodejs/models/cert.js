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

module.exports = {getCert};
