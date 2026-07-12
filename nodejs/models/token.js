'use strict';

const Table = require('.');
const UUID = function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};


class Token extends Table{
	static _key = 'token';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'token': {default: UUID, type: 'string', min: 36, max: 36, isPrivate: true},
		'is_valid': {default: true, type: 'boolean'},	
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

Token.register();

class AuthToken extends Token{
	static _keyMap = {
		...super._keyMap,
		user: {model: 'User', rel: 'one', localKey: 'created_by'},
		// Group memberships captured at login (OIDC `groups` claim or LDAP
		// group membership), stored as a JSON string. Drives authorization for
		// the life of the session without re-querying the IdP on every request.
		groups: {default: '[]', isRequired: false, type: 'string'},
	}

	static async create(data){
		data.created_by = data.username;
		if(Array.isArray(data.groups)){
			data.groups = JSON.stringify(data.groups);
		}
		return super.create(data)

	}

	// Parse the stored groups JSON back into an array, tolerating bad/missing
	// data so authorization never crashes on a malformed token.
	groupsArray(){
		try{
			let parsed = JSON.parse(this.groups);
			return Array.isArray(parsed) ? parsed : [];
		}catch(error){
			return [];
		}
	}
}
AuthToken.register();

module.exports = {Token, AuthToken};
