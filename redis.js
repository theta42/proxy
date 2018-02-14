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
	SADD: promisify(_client.SADD).bind(_client),
	HSET: promisify(_client.HSET).bind(_client),
};
