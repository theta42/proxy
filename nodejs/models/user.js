'use strict';

const linuxUser = require('linux-sys-user').promise();
const objValidate = require('../utils/object_validate');
const {Token, InviteToken} = require('./token');

var User = {}

User.keyMap = {
	'username': {isRequired: true, type: 'string', min: 3, max: 500},
	'password': {isRequired: true, type: 'string', min: 3, max: 500},
}

User.list = async function(){
	try{
		let users = await linuxUser.getUsers();

		for(let user of users){
			delete user.password
		}

		return users;
	}catch(error){
		throw error;
	}
};

User.get = async function(data){
	try{
		if(typeof data !== 'object'){
			let username = data;
			data = {};
			data.username = username;
		}
		
		let user = await linuxUser.getUserInfo(data.username);

		if(user){
			let obj = Object.create(this);
			Object.assign(obj, user);
			
			return obj;
		}else{
			let error = new Error('UserNotFound');
			error.name = 'UserNotFound';
			error.message = `PAM:${data.username} does not exists`;
			error.status = 404;
			throw error;
		}
	}catch(error){
		throw error;
	}
};

User.exists = async function(data){
	// Return true or false if the requested entry exists ignoring error's.
	try{
		await this.get(data);

		return true
	}catch(error){
		return false;
	}
};

User.add = async function(data) {
	try{
		data = objValidate.processKeys(this.keyMap, data);
		let systemUser = await linuxUser.addUser(data.username);
		await require('util').promisify(setTimeout)(500)
		let systemUserPassword = await linuxUser.setPassword(data.username, data.password);

		return this.get(data.username);

	}catch(error){
		if(error.message.includes('exists')){
			let error = new Error('UserNameUsed');
			error.name = 'UserNameUsed';
			error.message = `PAM:${data.username} already exists`;
			error.status = 409;

			throw error;
		}
		throw error;
	}
};

User.addByInvite = async function(data){
	try{
		let token = await InviteToken.get(data.token);

		if(!token.is_valid){
			let error = new Error('Token Invalid');
			error.name = 'Token Invalid';
			error.message = `Token is not valid or as allready been used. ${data.token}`;
			error.status = 401;
			throw error;
		}

		let user = await this.add(data);

		if(user){
			await token.consume({claimed_by: user.username});
			return user;
		}

	}catch(error){
		throw error;
	}

};

User.setPassword = async function(data){
	try{
		if(!data.password1 || data.password1 !== data.password2){
			throw new Error('PasswordMismatch');
		}

		await linuxUser.setPassword(this.username, data.password1);

		return this;
	}catch(error){
		throw error;
	}
};

User.invite = async function(){
	try{
		let token = await InviteToken.add({created_by: this.username});
		
		return token;

	}catch(error){
		throw error;
	}
};

module.exports = {User};
