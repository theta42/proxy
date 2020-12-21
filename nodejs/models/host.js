'use strict';

const Host = require('../utils/redis_model')({
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
	}
});

Host.lookupDict = {};

Host.make_lookup = async function(){
	try{
		for(let host of await this.list()){
			let fragments = host.split('.');
			let place = this.lookupDict;

			while(fragments.length !==0){
				let current = fragments.pop();
				if(!place[current]){
					place[current] = {};
				}

				if(fragments.length === 0){
					place[current]['#record'] = await this.get(host)
				}
				place = place[current];
			}
		}

	}catch(error){
		console.error(error);
	}
}

Host.lookUp = async function(host){
	let place = this.lookupDict;
	let last_resort = {};

	for(let fragment of host.split('.').slice().reverse()){
		// console.log('fragment', fragment, last_resort)

		if(place['**']) last_resort = place['**'];

		if({...place, ...last_resort}[fragment]){
			place = {...place, ...last_resort}[fragment];
		}else if(place['*']){
			place = place['*']
		}else if(last_resort){
			place = last_resort;
		}
	}

	if(place && place['#record']) return place['#record'];

}

module.exports = {Host};

(async function(){
	await Host.make_lookup();
	// console.log(Host.lookupDict)

	// console.log(Host.lookupDict['com']['vm42'])

	// console.log('test-res', await Host.lookUp('payments.test.com'))

	let count = 5
	console.log(count++, (await Host.lookUp('payments.test.com')).host === 'payments.**')
	console.log(count++, (await Host.lookUp('test.sample.other.exmaple.com')).host === '**.exmaple.com')
	console.log(count++, (await Host.lookUp('stan.test.vm42.com')).host === 'stan.test.vm42.com')
	console.log(count++, (await Host.lookUp('test.vm42.com')).host === 'test.vm42.com')
	console.log(count++, (await Host.lookUp('blah.test.vm42.com')).host === '*.test.vm42.com')
	console.log(count++, (await Host.lookUp('payments.example.com')).host === 'payments.**')	
	console.log(count++, (await Host.lookUp('info.wma.users.718it.biz')).host === 'info.*.users.718it.biz')
	console.log(count++, (await Host.lookUp('info.users.718it.biz')) === undefined)
	console.log(count++, (await Host.lookUp('test.1.2.718it.net')).host === 'test.*.*.718it.net')
	console.log(count++, (await Host.lookUp('test1.exmaple.com')).host === 'test1.exmaple.com')
	console.log(count++, (await Host.lookUp('other.exmaple.com')).host === '*.exmaple.com')


	return ;
})()
