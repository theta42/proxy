'use strict';

const Table = require('../models');
const {User, AuthToken} = Table.models; 


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
			console.log('check error', error);
			throw this.errors.login();
		}
	}

	static async logout(data){
		let token = await AuthToken.get(data);
		await token.destroy();
	}
}

module.exports = {Auth};
