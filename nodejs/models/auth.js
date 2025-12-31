'use strict';

const Table = require('../models');
const {User, AuthToken} = Table.models;

/**
 * Auth Model
 *
 * Handles authentication operations for the application.
 * Manages user login, token validation, and logout processes.
 *
 * Dependencies:
 * - User model: Validates user credentials
 * - AuthToken model: Creates and manages authentication tokens
 *
 * All methods throw standardized login errors on failure to avoid
 * leaking information about whether usernames exist or tokens are valid.
 */
class Auth{
	/**
	 * Standardized error responses for authentication failures.
	 * Returns generic "Invalid Credentials" message for security.
	 */
	static errors = {
		login: function(){
			let error = new Error('LoginFailed');
			error.name = 'LoginFailed';
			error.message = `Invalid Credentials, login failed.`;
			error.status = 401;

			return error;
		}
	}

	/**
	 * Authenticate user and create session token.
	 *
	 * @param {Object} data - Login credentials {username, password}
	 * @returns {Object} {user, token} - User object and auth token
	 * @throws {Error} Generic login error on any failure
	 *
	 * Flow:
	 * 1. Validate credentials via User.login()
	 * 2. Create new AuthToken for the user
	 * 3. Return both user data and token
	 */
	static async login(data){
		try{
			let user = await User.login(data);
			let token = await AuthToken.create({username: user.username});

			return {user, token}
		}catch(error){
			console.log('login error', error);
			throw this.errors.login();
		}
	}

	/**
	 * Validate an authentication token.
	 *
	 * @param {string} token - Token string to validate
	 * @returns {Object} Token object if valid
	 * @throws {Error} Generic login error if token invalid or expired
	 *
	 * Checks:
	 * 1. Token exists in database
	 * 2. Token has not expired (via token.check())
	 */
	static async checkToken(token){
		try{
			token = await AuthToken.get(token);
			if(token && token.check()) return token;

			throw this.errors.login();
		}catch(error){
			console.log('check error', error);
			throw this.errors.login();
		}
	}

	/**
	 * Destroy an authentication token (logout).
	 *
	 * @param {string} data - Token string to destroy
	 * @returns {void}
	 *
	 * Removes token from database, invalidating the session.
	 */
	static async logout(data){
		let token = await AuthToken.get(data);
		await token.destroy();
	}
}

module.exports = {Auth};
