'use strict';

const Table = require('.');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const conf = require('@simpleworkjs/conf');
const saltRounds = 10;

class User extends Table{
	static _key = 'username';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'username': {isRequired: true, type: 'string', min: 3, max: 500},
		'password': {isRequired: true, type: 'string', min: 3, max: 500, isPrivate: true},
		'backing': {default:"redis", isRequired: false, type: 'string',},
	}

	static backing = 'redis'

	static async create(data) {
		try{
			data['password'] = await bcrypt.hash(data['password'], saltRounds);
			data['backing'] = data['backing'] || 'redis';

		return await super.create(data)

		}catch(error){
			throw error;
		}
	}

	async setPassword(data){
		try{
			data['password'] = await bcrypt.hash(data['password'], saltRounds);

			return this.update(data);
		}catch(error){
			throw error;
		}
	}

	/**
	 * Just-in-time provisioning for an OIDC-authenticated user. Creates the
	 * local user on first login so relations (tokens, created_by, grants) have
	 * something to point at. OIDC users get a random, unusable password — they
	 * authenticate through the SSO, never the local password form.
	 *
	 * @param {Object} data - {username, ...} from the OIDC userinfo claims
	 * @returns {User} the existing or newly created user
	 */
	static async upsertOidc(data){
		try{
			return await User.get(data.username);
		}catch(error){
			return await User.create({
				username: data.username,
				password: crypto.randomBytes(24).toString('hex'),
				created_by: data.username,
				backing: 'oidc',
			});
		}
	}

	static async login(data){
		try{
			let user = await User.get(data);
			let auth = await bcrypt.compare(data.password, user.password);

			if(auth){
				return user
			}else{
				throw this.errors.login();
			}
		}catch(error){
			console.error('!!!!!!!!!!', error)
			if (error == 'Authentication failure'){
				throw this.errors.login()
			}
			throw error;
		}
	};
}

User.register();

(async function(){
	var defaultUser = 'proxyadmin2'
	// Optional: an orchestrator (e.g. theta-env's setup.sh) can set
	// auth.localAdminPass in proxy-secrets.js to a generated password so this
	// bootstrap account isn't left at a well-known default. Only used on first
	// creation -- once the account exists this is never read again, so it's
	// safe to leave set. If unset, a random password is generated and printed
	// once; save it from the log or set auth.localAdminPass explicitly.
	var defaultPass = (conf.auth && conf.auth.localAdminPass);
	if (!defaultPass) {
		defaultPass = crypto.randomBytes(16).toString('hex');
		console.warn(`====================================================================`);
		console.warn(`Bootstrap admin "${defaultUser}" created with random password:`);
		console.warn(`${defaultPass}`);
		console.warn(`Set auth.localAdminPass in your secrets file to make this deterministic.`);
		console.warn(`====================================================================`);
	}
	try{
		let user = await User.get(defaultUser);
	}catch(error){
		try{
			let user = await User.create({
				username:defaultUser,
				password: defaultPass,
				created_by: defaultUser
			});
			console.log(defaultUser, 'created');
		}catch(error){
			console.error(error)
		}
	}
})();