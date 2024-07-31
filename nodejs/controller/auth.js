'use strict';

const {User} = require('../models/user'); 
const {AuthToken} = require('../models/token');


class Auth{
	static errors = {
		login: function(){
			let error = new Error('LoginFailed');
			error.name = 'LoginFailed';
			error.message = `Invalid Credentials, login failed.`;
			error.status = 401;

			return error;
		}
	}

	static async login(data){
		try{
			let user = await User.login(data);
			let token = await AuthToken.create({username: user.username});

			return {user, token}
		}catch(error){
			console.log('login error', error);
			throw this.errors.login();
		}
	}

	static async checkToken(token){
		try{
			token = await AuthToken.get(token);
			if(token && token.check()) return token;

			throw this.errors.login();
		}catch(error){
			throw this.errors.login();
		}
	}

	static async logout(data){
		let token = await AuthToken.get(data);
		await token.destroy();
	}
}


Auth.logOut = async function(data){
	try{
	}catch(error){
		throw error;
	}
}

module.exports = {Auth};
