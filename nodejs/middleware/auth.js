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
		console.log('socket is good!')
		next();
	}catch(error){
		console.log('reject for', socket.handshake.auth.token)
		next(error);
	}
}

module.exports = {auth, authIO};
