'use strict';

const bcrypt = require('bcrypt');
const saltRounds = 10;

const {User} = require('./user_redis');
const {Token, AuthToken} = require('./token');

var Auth = {}
Auth.errors = {}

Auth.errors.login = function(){
	let error = new Error('ResisLoginFailed');
	error.name = 'RedisLoginFailed';
	error.message = `Invalid Credentials, login failed.`;
	error.status = 401;

	return error;
}

Auth.login = async function(data){
	try{
		let user = await User.get(data);

		let auth = await bcrypt.compare(data.password, user.password);

		if(auth){
			let token = await AuthToken.add(user);

			return {user, token}
		}else{
			throw this.errors.login();
		}
	}catch(error){
		if (error == 'Authentication failure'){
			throw this.errors.login()
		}
		throw error;
	}
};

Auth.checkToken = async function(data){
	try{
		let token = await AuthToken.get(data);
		if(token.is_valid){
			return await User.get(token.created_by);
		}
	}catch(error){
		throw this.errors.login();
	}
};

Auth.logOut = async function(data){
	try{
		let token = await AuthToken.get(data);
		await token.remove();
	}catch(error){
		throw error;
	}
}

module.exports = {Auth, AuthToken};
