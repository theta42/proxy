'use strict';

const {Auth} = require('../models/auth');

async function auth(req, res, next){
	try{
		req.token = await Auth.checkToken(req.header('auth-token'));
		req.user = req.token.user;
		return next();
	}catch(error){
		next(error);
	}
}

async function authIO(socket, next){
	try{
		let token = await Auth.checkToken(socket.handshake.auth.token || 0);
		socket.user = token.user;
		next();
	}catch(error){
		next(error);
	}
}

module.exports = {auth, authIO};
