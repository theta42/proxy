'use strict';

const { Client, Attribute, Change } = require('ldapts');
const {Token, InviteToken} = require('./token');
const conf = require('../conf').ldap;

const client = new Client({
  url: conf.url,
});


const user_parse = function(data){
	if(data[conf.userNameAttribute]){
		data.username = data[conf.userNameAttribute]
		delete data[conf.userNameAttribute];
	}

	if(data.uidNumber){
		data.uid = data.uidNumber;
		delete data.uidNumber;
	}

	return data;
}

var User = {}

User.backing = "LDAP";

User.keyMap = {
	'username': {isRequired: true, type: 'string', min: 3, max: 500},
	'password': {isRequired: true, type: 'string', min: 3, max: 500},
}

User.list = async function(){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		const res = await client.search(conf.searchBase, {
		  scope: 'sub',
		  filter: conf.userFilter,
		});

		await client.unbind();

		return res.searchEntries.map(function(user){return user.uid});
	}catch(error){
		throw error;
	}
};

User.listDetail = async function(){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		const res = await client.search(conf.searchBase, {
		  scope: 'sub',
		  filter: conf.userFilter,
		});

		await client.unbind();

		let users = []

		for(let user of res.searchEntries){
			let obj = Object.create(this);
			Object.assign(obj, user_parse(user));
			
			users.push(obj)

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
		
		await client.bind(conf.bindDN, conf.bindPassword);

		let filter = `(&${conf.userFilter}(${conf.userNameAttribute}=${data.username}))`;

		const res = await client.search(conf.searchBase, {
			scope: 'sub',
			filter: filter,
		});

		await client.unbind();

		let user = res.searchEntries[0]

		if(user){
			let obj = Object.create(this);
			Object.assign(obj, user_parse(user));
			
			return obj;
		}else{
			let error = new Error('UserNotFound');
			error.name = 'UserNotFound';
			error.message = `LDAP:${data.username} does not exists`;
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

User.invite = async function(){
	try{
		let token = await InviteToken.add({created_by: this.username});
		
		return token;

	}catch(error){
		throw error;
	}
};

User.login = async function(data){
	try{
		let user = await this.get(data.username);

		await client.bind(user.dn, data.password);

		await client.unbind();

		return user;

	}catch(error){
		throw error;
	}
};


module.exports = {User};


// (async function(){
// try{
// 	console.log(await User.list());

// 	console.log(await User.listDetail());

// 	console.log(await User.get('wmantly'))

// }catch(error){
// 	console.error(error)
// }
// })()