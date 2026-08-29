'use strict';

const { Client, Attribute, Change } = require('ldapts');
const conf = require('@simpleworkjs/conf').ldap;
const { escapeFilter } = require('@simpleworkjs/ldap');

// tlsOptions is optional and forwarded to ldapts so the proxy can bind to
// ldaps:// with a self-signed or internal-CA cert. Set via conf/secrets.js or
// app_* env, e.g. app_ldap__tlsOptions__rejectUnauthorized=false, or
// app_ldap__tlsOptions__ca=/etc/ssl/sso-ldap.crt for strict trust.
const client = new Client({
  url: conf.url,
  tlsOptions: conf.tlsOptions || {},
});

// Fresh, unbound ldapts Client. Used for the per-request bind-test in login()
// so that path never touches the shared module client (see below).
function newClient(){
	return new Client({
		url: conf.url,
		tlsOptions: conf.tlsOptions || {},
	});
}

// ldapts is NOT safe for concurrent use: a single Client carries the bind state
// of one connection, and overlapping bind/search/unbind calls from concurrent
// requests interleave into a corrupt sequence (e.g. a search running under
// another request's bind, or an unbind that tears down someone else's round
// trip). Serialize every shared-client operation through this promise-chain
// mutex: each holder runs, then the next. The `finally` always unbinds back to
// the service account so the next operation starts from a known state.
let clientChain = Promise.resolve();
function withClient(op){
	const run = clientChain.then(() => op());
	// Keep the chain alive whether op resolves or rejects, so one failed
	// operation can't stall every request behind it.
	clientChain = run.then(() => undefined, () => undefined);
	return run;
}


// Best-effort group extraction from a directory entry's `memberOf` values.
// Turns `cn=dns-team,ou=groups,dc=...` into `dns-team`. Directories that don't
// return memberOf simply yield no groups (see conf note); explicit group-search
// can be added later if needed.
const parse_groups = function(memberOf){
	if(!memberOf) return [];
	let values = Array.isArray(memberOf) ? memberOf : [memberOf];
	return values.map(function(dn){
		let match = /^cn=([^,]+)/i.exec(String(dn));
		return match ? match[1] : String(dn);
	});
}

const user_parse = function(data){
	if(data[conf.userNameAttribute]){
		data.username = data[conf.userNameAttribute]
		delete data[conf.userNameAttribute];
	}

	if(data.uidNumber){
		data.uid = data.uidNumber;
		delete data.uidNumber;
	}

	data.groups = parse_groups(data.memberOf);

	return data;
}

var User = {}

User.backing = "LDAP";

User.keyMap = {
	'username': {isRequired: true, type: 'string', min: 3, max: 500},
	'password': {isRequired: true, type: 'string', min: 3, max: 500},
}

User.list = async function(){
	return withClient(async function(){
		try{
			await client.bind(conf.bindDN, conf.bindPassword);

			const res = await client.search(conf.searchBase, {
			  scope: 'sub',
			  filter: conf.userFilter,
			});

			return res.searchEntries.map(function(user){return user.uid});
		}finally{
			// Always unbind back to a clean state for the next mutex holder.
			await client.unbind();
		}
	});
};


User.get = async function(data){
	if(typeof data !== 'object'){
		let username = data;
		data = {};
		data.username = username;
	}

	return withClient(async function(){
		try{
			await client.bind(conf.bindDN, conf.bindPassword);

			// Escape the interpolated username (RFC 4515) — previously raw, which
			// let `*`/`(`/`)`/`\`/NUL in a username break or broaden the filter.
			let filter = `(&${conf.userFilter}(${conf.userNameAttribute}=${escapeFilter(data.username)}))`;

			const res = await client.search(conf.searchBase, {
				scope: 'sub',
				filter: filter,
			});

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
		}finally{
			await client.unbind();
		}
	});
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

User.login = async function(data){
	// Look up the user's DN through the shared (mutex-guarded) client, then
	// bind-test the password on a FRESH per-request client. Using a dedicated
	// client means login never rebinds the shared connection as the user: the
	// shared client stays bound as the service account for reads, and concurrent
	// logins can't clobber each other's bind state on one connection.
	let user = await this.get(data.username);

	const c = newClient();
	try{
		await c.bind(user.dn, data.password);
		await c.unbind();

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