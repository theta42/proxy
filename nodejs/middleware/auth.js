'use strict';

const { Auth } = require('../controller/auth');

async function auth(req, res, next){
	try{
		req.token = await Auth.checkToken(req.header('auth-token'));
		req.user = await req.token.getUser();
		return next();
	}catch(error){
		next(error);
	}
}

async function authIO(socket, next){
	try{
		let token = await Auth.checkToken(socket.handshake.auth.token || 0);
		socket.user = await token.getUser();
		next();
	}catch(error){
		next(error);
	}
}

module.exports = {auth, authIO};
