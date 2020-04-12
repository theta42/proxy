'use strict';

const router = require('express').Router();
const {User} = require('../models/user_redis'); 

router.get('/', async function(req, res, next){
	try{
		return res.json({
			results:  await User[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		return res.json({results: await User.add(req.body)});
	}catch(error){
		next(error);
	}
});

router.delete('/:username', async function(req, res, next){
	try{
		let user = await User.get(req.params.username);

		return res.json({username: req.params.username, results: await user.remove()})
	}catch(error){
		next(error);
	}
});

router.get('/me', async function(req, res, next){
	try{
		return res.json({username: req.user.username});
	}catch(error){
		next(error);
	}
});

router.put('/password', async function(req, res, next){
	try{
		return res.json({results: await req.user.setPassword(req.body)})
	}catch(error){
		next(error);
	}
});

router.put('/password/:username', async function(req, res, next){
	try{
		let user = await User.get(req.params.username);
		return res.json({results: await user.setPassword(req.body)});
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
