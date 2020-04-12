'use strict';

const {Auth} = require('../models/auth_redis'); 

async function auth(req, res, next){
	try{
		let user = await Auth.checkToken({token: req.header('auth-token')});
		if(user.username){
			req.user = user;
			return next();
		}
	}catch(error){
		next(error);
	}
}

module.exports = {auth};
