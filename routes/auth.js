'use strict';

const router = require('express').Router();
const linuxUser = require('linux-user');
const {promisify} = require('util');

const Users = require('../models/users'); 

router.post('/login', async function(req, res){
	let username = req.body.username;
	let password = req.body.password;

	let groups = await Users.login({username, password})

	if(groups){
		return res.json({
			login: true,
			token: await Users.addToken({username}),
			groups: groups,
		});
	}else{
		return res.status(401).json({
			login: false
		});
	}

});

router.post('/verifykey', async function(req, res){
	let key = req.body.key;
	const verifySSHKey = promisify(linuxUser.verifySSHKey);

	let isValid;

	try{
		isValid = await verifySSHKey(key);
		return res.json({
			info: isValid
		});
	}catch(error){
		return res.status(400).json({
			message: 'Key is not a public key file!'
		});
	}
	
});

router.post('/:token', async function(req, res, next) {
	let username = req.body.username;
	let password = req.body.password;
	let token = req.params.token;

	let invite = await Users.checkInviteToken({token});

	console.log('invite', invite)

	if(!invite || invite.invited){
		return res.status(401).json({
			message: 'Token not valid'
		});
	}

	if(!username || !password){
		return res.status(400).json({
			message: 'Missing fields'
		});
	}

	if(await Users.ifUserExists({username})){
		return res.json({
			message: 'username taken'
		});
	}

	await Users.add({username, password, isAdmin: invite.isAdmin});

	await Users.useInviteToken({token, username});

	return res.json({user:username});

});

module.exports = router;
