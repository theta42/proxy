const {promisify} = require('util');
const linuxUser = require('linux-user');
const pam = require('authenticate-pam');
const client = require('../redis');

const UUID = function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};

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

async function checkInviteToken(data){
	let token = await client.HGET('users_tokens', data.token);

	return JSON.parse(token);
}

async function useInviteToken(data){
	let invite = await checkInviteToken(data);

	invite.invited = data.username;

	await client.HSET('users_tokens', data.token, JSON.stringify(invite));
}

/*
	Auth/ Auth token
*/

async function login(data){
	const authenticate = promisify(pam.authenticate);
	const getUserGroups = promisify(linuxUser.getUserGroups);

	try{
		await authenticate(data.username, data.password);
		let groups = await getUserGroups(data.username);
		console.log('groups', groups)
		return true;
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

	return user;
}

/*
	Users
*/

async function add(data) {
	const addUser = promisify(linuxUser.addUser);
	const setPassword = promisify(linuxUser.setPassword);

	let systemUser = await addUser(data.username);
	let systemUserPassword = await setPassword(data.username, data.password);

}

async function ifUserExists(data){
	const getUserInfo = promisify(linuxUser.getUserInfo);
	return await getUserInfo(data.username);
}

module.exports = {login, add, addToken, checkToken, ifUserExists,
	makeInviteToken, checkInviteToken, useInviteToken};
