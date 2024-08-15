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

		// Do not require "isRequired" fields for partial validation, useful for
		// updates.
		if(!map[key].always && partial && !data.hasOwnProperty(key)) continue;

		// Make sure required keys are present
		if(!partial && map[key].isRequired && !data.hasOwnProperty(key)){
			errors.push({key, message:`${key} is required.`});
			continue;
		}

		// Remove undefined keys unless they have a default option or are a
		// relation 
		if(data[key] === undefined){
			console.log('undefined key:', key, data[key], map[key], map[key].default);
			if(!map[key].default){
				if(map[key].model && !map[key].type) continue;
				continue;
			}
		}

		// Check the type of the key
		if(data.hasOwnProperty(key) && map[key].type && typeof(data[key]) !== map[key].type){
			errors.push({key, message:`${key} is not ${map[key].type} type.`});
			continue;
		}

		// Add the key to the process object to be returned and set any default
		// if the key is blank
		out[key] = data.hasOwnProperty(key) && data[key] !== undefined ? data[key] : returnOrCall(map[key].default);

		// Check for type specific validations, ie: string length
		if(data.hasOwnProperty(key) && process_type[map[key].type]){
			let typeError = process_type[map[key].type](map[key], data[key]);
			if(typeError){
				errors.push({key, message:`${key} ${typeError}`});
				
				continue;
			}
		}
	}

	// Check for errors, throw validation error if any
	if(errors.length !== 0){
		throw ObjectValidateError(errors);
		return {__errors__: errors};
	}

	return out;
}

function parseFromString(map, data){
	// Use the key maps data type to return string values to native
	let types = {
		boolean: function(value){ return value === 'false' ? false : true },
		number: Number,
		string: String,
		object: JSON.parse
	};

	for(let key of Object.keys(data)){
		if(map[key] && map[key].type && data[key]){
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

function ObjectValidateError(keys, message){
	let error = new Error('ObjectValidateError')
	error.name = "ObjectValidateError"
	error.message = message || `Invalid Keys: ${message}`
	error.keys = (keys || {});
	error.status = 422;

	return error
}

ObjectValidateError.prototype = Error.prototype;


module.exports = {processKeys, parseFromString, ObjectValidateError, parseToString};