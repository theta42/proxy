'use strict';

const router = require('express').Router();
const Users = require('../models/users'); 

router.post('/invite', async function(req, res){
	let token = await Users.makeInviteToken({
		username: res.user
	});

	return res.json({token:token});
});

router.post('/key', async function(req, res){
	let added = await Users.addSSHkey({
		username: req.user.username,
		key: req.body.key
	});

	return res.status(added === true ? 200 : 400).json({
		message: added
	});

});

module.exports = router;
