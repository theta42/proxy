'use strict';

const Users = require('../models/users'); 

async function auth(req, res, next){
	if(req.header('auth-token')){
		let user = await Users.checkToken({token: req.header('auth-token')});
		if(user.username){
			req.user = user;
			return next();
		}
	}

	return res.status(401).json({
		message: 'Login failed'
	});
}

module.exports = {auth};
