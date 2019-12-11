'use strict';

const {promisify} = require('util');
const client = require('../redis');
const linuxUser = require('linux-sys-user');
const pam = require('authenticate-pam');

const UUID = function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};

const authenticate = promisify(pam.authenticate);

const addSSHtoUser = promisify(linuxUser.addSSHtoUser)
const getUserGroups = promisify(linuxUser.getUserGroups);
const verifySSHKey = promisify(linuxUser.verifySSHKey);
const addUser = promisify(linuxUser.addUser);
const setPassword = promisify(linuxUser.setPassword);

/*
	Invite
*/
async function makeInviteToken(data){
	let token = UUID();
	await client.HSET('users_tokens', token, JSON.stringify({
		created_by: data.username,
		isAdmin: data.isAdmin,
		invited: false
	}));

	return token;
}

async function checkInvite(data){
	let token = await client.HGET('users_tokens', data.token);

	return JSON.parse(token);
}

async function consumeInvite(data){
	let invite = await checkInvite(data);

	invite.invited = data.username;

	await client.HSET('users_tokens', data.token, JSON.stringify(invite));
}

/*
	Auth/ Auth token
*/

async function login(data){
	try{
		await authenticate(data.username, data.password);

		return await getUserGroups(data.username);
	}catch(error){
		return false;
	}
}

async function addToken(data){
	let token = UUID();
	await client.HSET('users_tokens', token, data.username);

	return token;
}

async function checkToken(data){
	let user = await client.HGET('users_tokens', data.token);

	return {
		username: user,
		groups: (user && await getUserGroups(user))
	}
}

async function addSSHkey(data){

	try{
		let user = await addSSHtoUser(data.username, data.key);
		return true;
	} catch (error) {
		return error;
	}
}

/*
	Users
*/

async function add(data) {

	let systemUser = await addUser(data.username);
	let systemUserPassword = await setPassword(data.username, data.password);

}

async function verifyKey(data){
	return await verifySSHKey(key)
}

async function ifUserExists(data){
	const getUserInfo = promisify(linuxUser.getUserInfo);
	return await getUserInfo(data.username);
}

module.exports = {login, add, addToken, checkToken, ifUserExists,
	makeInviteToken, checkInvite, consumeInvite, addSSHkey, verifyKey};
