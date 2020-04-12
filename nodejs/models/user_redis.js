'use strict';

const objValidate = require('../utils/object_validate');
const {Token, InviteToken} = require('./token');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const User = require('../utils/redis_model')({
	_name: 'user',
	_key: 'username',
	_keyMap: {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'username': {isRequired: true, type: 'string', min: 3, max: 500},
		'password': {isRequired: true, type: 'string', min: 3, max: 500},
		'backing': {default:"redis", isRequired: false, type: 'string',},
	}
});

User.add = async function(data) {
	try{
		data['password'] = await bcrypt.hash(data['password'], saltRounds);
		data['backing'] = data['backing'] || 'redis';


		return this.__proto__.add(data);

	}catch(error){
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
		data['password'] = await bcrypt.hash(data['password'], saltRounds);

		return this.__proto__.update(data);
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


(async function(){
	try{
		await User.get('proxyadmin1');
		console.info('proxyadmin1 user exists');
	}catch(error){
		try{
			let user = await User.add({
				username:'proxyadmin1',
				password: 'proxyadmin1',
				created_by:'proxyadmin1'
			});
			console.log('proxyadmin1 created', user);	
		}catch(error){
			console.error(error)
		}
	}
})();