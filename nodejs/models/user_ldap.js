'use strict';

const { Client, Attribute, Change } = require('ldapts');
const {Token, InviteToken} = require('./token');
const conf = require('../conf').ldap;

const client = new Client({
  url: conf.url,
});


class LdapModel extends Model{
	static modelBacking = LdapModel;
	static client = client;

}


class User extends Model{

	static user_parse(data){
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

	static async get(data, ...args){
		try{
			if(typeof index === 'object'){
				index = index[this._key];
			}

			await this.client.bind(conf.bindDN, conf.bindPassword);

			const res = await this.client.search(conf.searchBase, {
				scope: 'sub',
				filter: `(&${conf.userFilter}(${conf.userNameAttribute}=${data.username}))`,
			});

			await this.client.unbind();

			if(!res.searchEntries[0]) throw this.errors.EntryNotFound(index)
			
			return this(user_parse(res.searchEntries[0]));
		}catch(error){
			throw error;
		}
	}

	static async login(data){
		try{
			let user = await this.get(data.username);

			await client.bind(user.dn, data.password);

			await client.unbind();

			return user;

		}catch(error){
			throw error;
		}
	};
}

