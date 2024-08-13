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

class DnsApi{
	errors = {
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

	static info(){
		let svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.displayIconHtml)
		  .replace(/'/g, '%27')
		  .replace(/"/g, '%22')}`

		return {
			displayName: this.displayName,
			displayIconUni: this.displayIconUni,
			displayIconHtml: svgDataUrl,
			fields: this._keyMap,
		}
	}

	static toJSON(){
		return {
			...this.info(),
		}
	}

	toJSON(){
		return this.constructor.toJSON()
	}
}

module.exports = {
	dnsErrors,
	DnsApi,
};

