'use strict';

let dnsErrors = {
	unauthorized(instance){
		let error = new Error('UnauthorizedDnsApi');
		error.name = 'UnauthorizedDnsApi';
		error.message = `Unauthorized call to ${instance.constructor ? instance.constructor.name : instance.name}`;
		error.status = 424;

		return error;
	},
	other(instance, status, message){
		let error = new Error('OtherDnsApiError');
		error.name = 'OtherDnsApiError';
		error.message = `DNS API Error ${instance.constructor ? instance.constructor.name : instance.name}: `;
		error.status = 424;

		return error;
	},
}

module.exports = {
	dnsErrors
};

