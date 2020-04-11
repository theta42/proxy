'use ';

const client = require('../utils/redis');

(async function(){
	await client.rename('proxy_hosts', 'proxy_host');
	let hosts = await client.SMEMBERS('proxy_host');
	
	for(let host of hosts){
		let user = await client.HGET('proxy_host_'+host, 'username');
		await client.HSET('proxy_host_'+host, 'created_by', user);
		let created_on = client.HGET('proxy_host_'+host, 'updated');
		await client.HSET('proxy_host_'+host, 'created_on', created_on);
		await client.HDEL('proxy_host_'+host, 'username');
		await client.HDEL('proxy_host_'+host, 'updated')
	}
})()
