'use strict';

const Table = require('../utils/redis_model');
const bcrypt = require('bcrypt');
const saltRounds = 10;

class User extends Table{
	static _key = 'username';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'username': {isRequired: true, type: 'string', min: 3, max: 500},
		'password': {isRequired: true, type: 'string', min: 3, max: 500},
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

module.exports = {User};


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