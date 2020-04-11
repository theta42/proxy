'use ';

const client = require('../utils/redis');

(async function(){
	await client.rename('hosts', 'host');
	let hosts = await client.SMEMBERS('host');

	for(let host of hosts){
		let user = await client.HGET('host_'+host, 'username');
		await client.HSET('host_'+host, 'created_by', user);
		let created_on = await client.HGET('host_'+host, 'updated');
		await client.HSET('host_'+host, 'created_on', created_on);
		await client.HDEL('host_'+host, 'username');
		await client.HDEL('host_'+host, 'updated');
	}
})()
