const {promisify} = require('util');
const pam = require('authenticate-pam');
const authenticate = promisify(pam.authenticate);

const {User} = require('./user');
const {Token, AuthToken} = require('./token');

Auth = {}
Auth.errors = {}

Auth.errors.login = function(){
	let error = new Error('PamLoginFailed');
	error.name = 'PamLoginFailed';
	error.message = `Invalid Credentials, login failed.`;
	error.status = 401;

	return error;
}

Auth.login = async function(data){
	try{
		let auth = await authenticate(data.username, data.password);
		let user = await User.get(data);
		let token = await AuthToken.add(user);

		return {user, token}
	}catch(error){
		if (error == 'Authentication failure'){
			throw this.errors.login()
		}
		throw error;
	}
};

Auth.checkToken = async function(data){
	try{
		let token = await AuthToken.get(data);
		if(token.is_valid){
			return await User.get(token.created_by);
		}
	}catch(error){
		throw this.errors.login();
	}
};

Auth.logOut = async function(data){
	try{
		let token = await AuthToken.get(data);
		await token.remove();
	}catch(error){
		throw error;
	}
}

module.exports = {Auth, AuthToken};
