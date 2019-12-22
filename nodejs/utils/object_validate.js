'use strict';

const process_type = {
	number: function(key, value){
		if(key.min && value < key.min) return `is to small, min ${key.min}.`
		if(key.max && value > key.max) return `is to large, max ${key.max}.`
	},
	string: function(key, value){
		if(key.min && value.length < key.min) return `is too short, min ${key.min}.`
		if(key.max && value.length > key.max) return `is too short, max ${key.max}.`
	}
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

		if(data.hasOwnProperty(key) && typeof(data[key]) !== map[key].type){
			errors.push({key, message:`${key} is not ${map[key].type} type.`});
			continue;
		}

		out[key] = data.hasOwnProperty(key) ? data[key] : returnOrCall(map[key].default);

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
		boolean: function(value){ return value === 'true' ? true : false },
		number: Number,
		string: String,
	};

	for(let key of Object.keys(data)){
		console.log('looking at', key)
		if(map[key] && map[key].type){
			console.log('converting', data[key], 'to', map[key].type)
			data[key] = types[map[key].type](data[key]);
		}
	}

	return data;
}

function ObjectValidateError(message) {
	this.name = 'ObjectValidateError';
	this.message = (message || {});
	this.status = 422;
}
ObjectValidateError.prototype = Error.prototype;


module.exports = {processKeys, parseFromString, ObjectValidateError};

if (require.main === module) {
	const keys_map = {
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'ip': {isRequired: true, type: 'string', min: 3, max: 500},
		'updated': {default: function(){return (new Date).getTime()}, always:true},
		'username': {isRequired: true, type: 'string', always: true},
		'targetport': {isRequired: true, type: 'number', min:0, max:65535},
		'forcessl': {isRequired: false, default: true, type: 'boolean'},
		'targetssl': {isRequired: false, default: false, type: 'boolean'},
	}

	console.log(processKeys(keys_map, {
		host:'asdqwwd',
		ip: 'sdfwef',
		username: '',
		targetport: 8000,
		updated: 'dqwqwdq'
	}));


	console.log(parseFromString(keys_map, {
		host: 'stest.theta42.com',
		ip: 'googs',
		updated: '1577054966047',
		username: 'william',
		targetport: '8080',
		forcessl: 'true',
		targetssl: 'false' }
	))

}


