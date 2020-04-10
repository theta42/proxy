'use strict';

const router = require('express').Router();
const {User} = require('../models/user'); 


router.get('/me', async function(req, res){
	try{
		return res.json({username: req.user.username});
	}catch(error){
		next(error);
	}
});

router.post('/invite', async function(req, res, next){
	try{
		let token = await req.user.invite();

		return res.json({token: token.token});
	}catch(error){
		next(error);
	}
});

router.post('/key', async function(req, res, next){
	try{
		let added = await User.addSSHkey({
			username: req.user.username,
			key: req.body.key
		});

		return res.status(added === true ? 200 : 400).json({
			message: added
		});

	}catch(error){
		next(error);
	}

});

module.exports = router;
