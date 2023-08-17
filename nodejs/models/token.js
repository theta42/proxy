'use strict';

const Table = require('../utils/redis_model');
const UUID = function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};


class Token extends Table{
	static _key = 'token';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'token': {default: UUID, type: 'string', min: 36, max: 36},
		'is_valid': {default: true, type: 'boolean'}
	}

	constructor(...args){
		super(...args);
	}

	async check(){
		try{
			return this.is_valid;
		}catch(error){
			return false
		}
	}
}

class AuthToken extends Token{
	constructor(...args){
		super(...args);
	}

	static async add(data){
		data.created_by = data.username;
		return super.add(data)

	}

}

class InviteToken extends Token{
	static _keyMap = {
		...super._keyMap,
		claimed_by: {default:"__NONE__", isRequired: false, type: 'string',},
	}

	async consume(data){
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
}

module.exports = {Token, InviteToken, AuthToken};
