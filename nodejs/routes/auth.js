'use strict';

const router = require('express').Router();
const { Auth } = require('../controller/auth');

router.post('/login', async function(req, res, next){
	try{
		let auth = await Auth.login(req.body);
		return res.json({
			login: true,
			token: auth.token.token,
			message:`${req.body.username} logged in!`,
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

module.exports = router;
