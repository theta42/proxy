'use strict';

const router = require('express').Router();
const Users = require('../models/users'); 

/*
	Password login
*/
router.post('/login', async function(req, res){
	let username = req.body.username;
	let password = req.body.password;

	let groups = await Users.login({username, password});

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

/*
	verify public ssh key
*/
router.post('/verifykey', async function(req, res){
	let key = req.body.key;

	try{
		return res.json({
			info: await Users.verifyKey(key)
		});
	}catch(error){
		return res.status(400).json({
			message: 'Key is not a public key file!'
		});
	}
	
});


router.post('/invite/:token', async function(req, res, next) {
	let username = req.body.username;
	let password = req.body.password;
	let token = req.params.token;

	// make sure invite token is valid
	let invite = await Users.checkInvite({token});

	if(!invite || invite.invited){
		return res.status(401).json({
			message: 'Token not valid'
		});
	}

	// make sure requires fields are in
	if(!username || !password){
		return res.status(400).json({
			message: 'Missing fields'
		});
	}

	// make sure the requested user name can be used 
	if(await Users.ifUserExists({username})){
		return res.status(409).json({
			message: 'Username taken'
		});
	}

	// create the new user
	await Users.add({username, password, isAdmin: invite.isAdmin});

	// consume the invite token
	await Users.consumeInvite({token, username});

	// send back API token for the new user
	return res.json({
		user: username,
		token: await Users.addToken({username})
	});

});

module.exports = router;
