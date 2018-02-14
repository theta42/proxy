const router = require('express').Router();
const Users = require('../models/users'); 


router.post('/invite', async function(req, res){
	let token = await Users.makeInviteToken({
		username: res.user
	});

	return res.json({token:token})
});

module.exports = router;
