'use strict';

const {createClient} = require('redis');
const objValidate = require('../utils/object_validate');
const conf = require('../conf/conf');

const client = createClient({});

(async function(){
	try{
		await client.connect()
		// Hosts
		for(let host of await client.SMEMBERS('proxy_host')){
			console.log('\n\n'+host)
			let host_ = host;
			host = await client.HGETALL(`proxy_host_${host}`)

			host.host = host.host || host_;

			await client.SADD(`proxy_Host`, host.host)
			for (const [key, value] of Object.entries(host)) {
				console.log(`${key}: ${value}`);
				await client.HSET(`proxy_Host_${host.host}`, key, value)
			}

			await client.SREM(`proxy_host`, host.host);

			await client.DEL(`proxy_host_${host.host}`);
		}

		await client.DEL('proxy_host');
		console.log('done with hots')

		// Auth Token
		for(let token of await client.SMEMBERS('proxy_token_auth')){
			console.log('\n\n'+token)
			token = await client.HGETALL(`proxy_token_auth_${token}`)

			await client.SADD(`proxy_AuthToken`, token.token)
			for (const [key, value] of Object.entries(token)) {
				console.log(`${key}: ${value}`);
				await client.HSET(`proxy_AuthToken_${token.token}`, key, value)
			}

			await client.SREM(`proxy_token_auth`, token.token);

			await client.DEL(`proxy_token_auth_${token.token}`);
		}

		await client.DEL('proxy_token_auth');
		console.log('done with tokens')

		// User
		for(let user of await client.SMEMBERS('proxy_user')){
			console.log('\n\n'+user)
			user = await client.HGETALL(`proxy_user_${user}`)

			await client.SADD(`proxy_User`, user.username)
			for (const [key, value] of Object.entries(user)) {
				console.log(`${key}: ${value}`);
				await client.HSET(`proxy_User_${user.username}`, key, value)
			}

			await client.SREM(`proxy_user`, user.username);

			await client.DEL(`proxy_user_${user.username}`);
		}

		await client.DEL('proxy_user');
		console.log('done with users')


	}catch(error){
		console.log('ERROR!', error)
	}
})();
