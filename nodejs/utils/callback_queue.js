'use strict';

class CallbackQueue{
	constructor(callbacks){
		this.__callbacks = [];

		for(let callback of Array.isArray(callbacks) ? callbacks : [callbacks]){
			this.push(callback);
		}
	}

	push(callback){
		if(callback instanceof Function){
			this.__callbacks.push(callback);
		}
	}

	call(){
		let args = arguments;
		this.__callbacks.forEach(function(callback){
			callback(...args);
		}.bind(this))
	}
}

module.exports = {CallbackQueue};
