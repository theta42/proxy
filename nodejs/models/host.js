'use strict';

const RedisModel = require('../utils/redis_model');

const Host = RedisModel({
	_name: 'host',
	_key: 'host',
	_keyMap: {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'ip': {isRequired: true, type: 'string', min: 3, max: 500},
		'targetPort': {isRequired: true, type: 'number', min:0, max:65535},
		'forcessl': {isRequired: false, default: true, type: 'boolean'},
		'targetssl': {isRequired: false, default: false, type: 'boolean'},
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'is_cahced': {default: false, isRequired: false, type: 'boolean',},


	}
});

const Cached = RedisModel({
	_name: 'cached',
	_key: 'host',
	_keyMap: {
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'parent': {isRequired: true, type: 'string', min: 3, max: 500},
	}
});


Host.addCache = async function(host, parentOBJ){
	try{
		await Host.__proto__.add.apply(this, [{...parentOBJ, host, is_cahced: true}, true])
		await Cached.add({
			host: host,
			parent: parentOBJ.host
		});
	}catch(error){
		console.error('add cahce error', {...parentOBJ, host, is_cahced: true}, error)
		throw error;
	}
};

Host.bustCache = async function(parent){
	try{
		let cached = await Cached.listDetail();
		for(let cache of cached){
			if(cache.parent == parent){
				let host = await Host.get(cache.host);
				await Host.__proto__.remove.apply(host);
				await cache.remove();
			}
		}

	}catch(error){
		console.error('bust cache error', error)

		throw error;
	}
}

Host.add = async function(){
	try{
		let out = await Host.__proto__.add.apply(this, arguments)
		await Host.buildLookUpObj()

		return out;
	} catch(error){
		throw error;
	}
};

Host.update = async function(data, key){
	try{
		let out = await Host.__proto__.update.apply(this, arguments)
		await Host.bustCache(this.host)
		await Host.buildLookUpObj()

		return out;
	} catch(error){
		throw error;
	}
};

Host.remove = async function(){
	try{
		let out = await Host.__proto__.remove.apply(this, arguments)
		await Host.buildLookUpObj()
		await Host.bustCache(this.host)

		return out;
	} catch(error){
		throw error;
	}
};

Host.lookUpObj = {};

Host.buildLookUpObj = async function(){
	/*
	Build a look up tree for domain records in the redis back end to allow
	complex looks with wildcards.
	*/

	// Hold lookUp ready while the look up object is being built.
	this.__lookUpIsReady = false;
	this.lookUpObj = {};

	try{

		// Loop over all the hosts in the redis.
		for(let host of await this.list()){

			// Spit the hosts on "." into its fragments .
			let fragments = host.split('.');

			// Hold a pointer to the root of the lookup tree.
			let pointer = this.lookUpObj;

			// Walk over each fragment, popping from right to left. 
			while(fragments.length){
				let fragment = fragments.pop();

				// Add a branch to the lookup at the current position
				if(!pointer[fragment]){
					pointer[fragment] = {};
				}

				// Add the record(leaf) when we hit the a full host name.
				// #record denotes a leaf node on this tree.
				if(fragments.length === 0){
					pointer[fragment]['#record'] = await this.get(host)
				}

				// Advance the pointer to the next level of the tree.
				pointer = pointer[fragment];
			}
		}

		// When the look up tree is finished, remove the ready hold.
		this.__lookUpIsReady = true;

	}catch(error){
		console.error(error);
	}
};

Host.lookUp = function(host){
	/*
	Perform a complex lookup of @host on the look up tree.
	*/


	// Hold a pointer to the root of the look up tree
	let place = this.lookUpObj;

	// Hold the last passed long wild card.
	let last_resort = {};

	// Walk over each fragment of the host, from right to left
	for(let fragment of host.split('.').reverse()){

		// If a long wild card is found on this level, hold on to it
		if(place['**']) last_resort = place['**'];

		// If we have a match for the current fragment, update the current pointer
		// A match in the lookup tree takes priority being a more exact match.
		if({...last_resort, ...place}[fragment]){
			place = {...last_resort, ...place}[fragment];
		// If we have a not exact fragment match, a wild card will do.
		}else if(place['*']){
			place = place['*']
		// If no fragment can be matched, continue with the long wild card branch.
		}else if(last_resort){
			place = last_resort;
		}
	}

	// After the tree has been traversed, see if we have leaf node to return. 
	if(place && place['#record']) return place['#record'];
};

Host.__lookUpIsReady = false;

Host.lookUpReady = async function(){
	/*
	Wait for the lookup tree to be built.
	*/

	// Check every 5ms to see if the look up tree is ready
	while(!this.__lookUpIsReady) await new Promise(r => setTimeout(r, 5));
	return true;
};

(async function(){
	await Host.buildLookUpObj();
})()

module.exports = {Host};

(async function(){

	await Host.lookUpReady();

	// console.log(Host.lookUpObj)

	// console.log(Host.lookUpObj['com']['vm42'])

	// console.log('test-res', await Host.lookUp('payments.718it.biz'))

	let count = 6
	console.log(count++, Host.lookUp('payments.718it.biz').host === 'payments.718it.biz')
	console.log(count++, Host.lookUp('sd.blah.test.vm42.com') === undefined)
	console.log(count++, Host.lookUp('payments.test.com').host === 'payments.**')
	console.log(count++, Host.lookUp('test.sample.other.exmaple.com').host === '**.exmaple.com')
	// console.log(count++, Host.lookUp('stan.test.vm42.com').host === 'stan.test.vm42.com')
	console.log(count++, Host.lookUp('test.vm42.com').host === 'test.vm42.com')
	console.log(count++, Host.lookUp('blah.test.vm42.com').host === '*.test.vm42.com')
	console.log(count++, Host.lookUp('payments.example.com').host === 'payments.**')	
	console.log(count++, Host.lookUp('info.wma.users.718it.biz').host === 'info.*.users.718it.biz')
	console.log(count++, Host.lookUp('infof.users.718it.biz') === undefined)
	console.log(count++, Host.lookUp('blah.biz') === undefined)
	console.log(count++, Host.lookUp('test.1.2.718it.net').host === 'test.*.*.718it.net')
	console.log(count++, Host.lookUp('test1.exmaple.com').host === 'test1.exmaple.com')
	console.log(count++, Host.lookUp('other.exmaple.com').host === '*.exmaple.com')
	console.log(count++, Host.lookUp('info.payments.example.com').host === 'info.**')
	console.log(count++, Host.lookUp('718it.biz').host === '718it.biz')


})()
