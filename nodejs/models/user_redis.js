'use strict';

const Table = require('.');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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
	try{
		let user = await User.get(defaultUser);
	}catch(error){
		try{
			let user = await User.create({
				username:defaultUser,
				password: defaultUser,
				created_by: defaultUser
			});
			console.log(defaultUser, 'created', user);	
		}catch(error){
			console.error(error)
		}
	}
})();