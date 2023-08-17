'use strict';

const process_type = {
	number: function(key, value){
		if(key.min && value < key.min) return `is to small, min ${key.min}.`
		if(key.max && value > key.max) return `is to large, max ${key.max}.`
	},
	string: function(key, value){
		if(key.min && value.length < key.min) return `is too short, min ${key.min}.`
		if(key.max && value.length > key.max) return `is too short, max ${key.max}.`
	},
}

function returnOrCall(value){
	return typeof(value) === 'function' ? value() : value;
} 

function processKeys(map, data, partial){
	let errors = [];
	let out = {};

	for(let key of Object.keys(map)){

		if(!map[key].always && partial && !data.hasOwnProperty(key)) continue;

		if(!partial && map[key].isRequired && !data.hasOwnProperty(key)){
			errors.push({key, message:`${key} is required.`});
			continue;
		} 

		if(data.hasOwnProperty(key) && map[key].type && typeof(data[key]) !== map[key].type){
			errors.push({key, message:`${key} is not ${map[key].type} type.`});
			continue;
		}

		out[key] = data.hasOwnProperty(key) && data[key] !== undefined ? data[key] : returnOrCall(map[key].default);

		if(data.hasOwnProperty(key) && process_type[map[key].type]){
			let typeError = process_type[map[key].type](map[key], data[key]);
			if(typeError){
				errors.push({key, message:`${key} ${typeError}`});
				
				continue;
			}
		}
	}

	if(errors.length !== 0){
		throw new ObjectValidateError(errors);
		return {__errors__: errors};
	}

	return out;
}

function parseFromString(map, data){
	let types = {
		boolean: function(value){ return value === 'false' ? false : true },
		number: Number,
		string: String,
		object: JSON.parse
	};

	for(let key of Object.keys(data)){
		if(map[key] && map[key].type){
			data[key] = types[map[key].type](data[key]);
		}
	}

	return data;
}

function parseToString(data){
	let types = {
		object: JSON.stringify
	}

	return (types[typeof(data)] || String)(data);
}

function ObjectValidateError(message) {
	this.name = 'ObjectValidateError';
	this.message = (message || {});
	this.status = 422;
}

ObjectValidateError.prototype = Error.prototype;


module.exports = {processKeys, parseFromString, ObjectValidateError, parseToString};