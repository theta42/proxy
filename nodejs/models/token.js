'use strict';

const redis_model = require('../utils/redis_model')
const UUID = function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};


const Token = function(data){
	return redis_model({
		_name: `token_${data.name}`,
		_key: 'token',
		_keyMap: Object.assign({}, {
			'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
			'created_on': {default: function(){return (new Date).getTime()}},
			'updated_on': {default: function(){return (new Date).getTime()}, always: true},
			'token': {default: UUID, type: 'string', min: 36, max: 36},
			'is_valid': {default: true, type: 'boolean'}
		}, data.keyMap || {})
	});
};

Token.check = async function(data){
	try{
		return this.is_valid;
	}catch(error){
		return false
	}
}

var InviteToken = Object.create(Token({
	name: 'invite',
	keyMap:{
		claimed_by: {default:"__NONE__", isRequired: false, type: 'string',}
	}
}));

InviteToken.consume = async function(data){
	try{
		if(this.is_valid){
			data['is_valid'] = false;

			await this.update(data);
			return true;
		}
		return false;

	}catch(error){
		throw error;
	}
}

var AuthToken = Object.create(Token({
	name: 'auth',
}));

AuthToken.add = async function(data){
	data.created_by = data.username;
	return AuthToken.__proto__.add(data);
};

module.exports = {Token, InviteToken, AuthToken}
