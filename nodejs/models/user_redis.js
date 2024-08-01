'use strict';

const Table = require('../utils/redis_model');
// const {Token, InviteToken} = require('./token');
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

	static async add(data) {
		try{
			data['password'] = await bcrypt.hash(data['password'], saltRounds);
			data['backing'] = data['backing'] || 'redis';


		return await super.create(data)

		}catch(error){
			throw error;
		}
	}

/*	static async addByInvite(data){
		try{
			let token = await InviteToken.get(data.token);

			if(!token.is_valid){
				let error = new Error('Token Invalid');
				error.name = 'Token Invalid';
				error.message = `Token is not valid or as allready been used. ${data.token}`;
				error.status = 401;
				throw error;
			}

			let user = await this.create(data);

			if(user){
				await token.consume({claimed_by: user.username});
				return user;
			}

		}catch(error){
			throw error;
		}

	};*/

	async setPassword(data){
		try{
			data['password'] = await bcrypt.hash(data['password'], saltRounds);

			return this.update(data);
		}catch(error){
			throw error;
		}
	}

/*	async invite(){
		try{
			let token = await InviteToken.create({created_by: this.username});
			
			return token;

		}catch(error){
			throw error;
		}
	}*/

	static async login(data){
		try{

			console.log('login data', data)

			let user = await User.get(data);

			console.log('login user', user)
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
	var defaultUser = 'proxyadmin3'
	try{
		let user = await User.get(defaultUser);
	}catch(error){
		try{
			let user = await User.create({
				username:defaultUser,
				password: defaultUser,
				created_by:defaultUser
			});
			console.log(defaultUser, 'created', user);	
		}catch(error){
			console.error(error)
		}
	}
})();