'use strict';

const router = require('express').Router();
const {User} = require('../models/user');
const {Auth, AuthToken} = require('../models/auth'); 


router.post('/login', async function(req, res, next){
	try{
		let auth = await Auth.login(req.body);
		return res.json({
			login: true,
			token: auth.token.token,
		});
	}catch(error){
		next(error);
	}
});

router.all('/logout', async function(req, res, next){
	try{
		if(req.user){
			await req.user.logout();
		}

		res.json({message: 'Bye'})
	}catch(error){
		next(error);
	}
});

router.post('/invite/:token', async function(req, res, next) {
	try{
		req.body.token = req.params.token;
		let user = await User.addByInvite(req.body);
		let token = await AuthToken.add(user);

		return res.json({
			user: user.username,
			token: token.token
		});

	}catch(error){
		next(error);
	}

});

module.exports = router;

/*
	verify public ssh key
*/
// router.post('/verifykey', async function(req, res){
// 	let key = req.body.key;

// 	try{
// 		return res.json({
// 			info: await Users.verifyKey(key)
// 		});
// 	}catch(error){
// 		return res.status(400).json({
// 			message: 'Key is not a public key file!'
// 		});
// 	}
	
// });