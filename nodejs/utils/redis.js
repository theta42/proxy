const {createClient} = require('redis');
const {promisify} = require('util');

const config = {
	prefix: 'proxy_'
}

function client() {
	return createClient(config);
}

const _client = client();

module.exports = {
	client: client,
	HGET: promisify(_client.HGET).bind(_client),
	HDEL: promisify(_client.HDEL).bind(_client),
	SADD: promisify(_client.SADD).bind(_client),
	SREM: promisify(_client.SREM).bind(_client),
	DEL: promisify(_client.DEL).bind(_client),
	HSET: promisify(_client.HSET).bind(_client),
	HGETALL: promisify(_client.HGETALL).bind(_client),
	SMEMBERS: promisify(_client.SMEMBERS).bind(_client),
};
