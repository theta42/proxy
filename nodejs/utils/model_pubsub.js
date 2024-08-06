'use strict';
const ps = require('../controller/pubsub');


function ModelPs(model){
	const Model = model.constructor.name === 'Function' ? model : model.constructor
	
	function getIndex(req, res){
		if(model[Model._key]) return model[Model._key];
		if(req && req[Model._key]) return req[Model._key];
		if(res && res[Model._key]) return res[Model._key];
	}

	function publish(prop, res, req){
		try{
			if(!['add', 'create', 'update', 'remove'].includes(prop)) return;

			ps.publish(`model:${Model.name}:${prop}:${getIndex(res, req)}`, res);
		}catch(error){
			console.log('ModelPs.publish ERROR', error)
		}
	}

	return new Proxy(model, {
		construct(target, args) {
			let instance = ModelPs(new model(...args));

			return instance;
		},
		get(target, propKey, receiver) {
			if(propKey == 'constructor') return target.constructor;
			const targetValue = Reflect.get(target, propKey, receiver);
			if (typeof targetValue === 'function') {
				return function(...args){
					try{
					// let res = targetValue.apply(this, args); // (A)
						var res = Reflect.apply(targetValue, this, args);
						if(targetValue.constructor.name === 'AsyncFunction'){
							res.then(function(res){
								publish(propKey, res, ...args);
							}).catch(function(error){
								console.log('toDo, publish errors...')
							});
						}else{
							publish(propKey, res, ...args)
						}
						return res;
					}catch(error){
						console.log("grrrr")
					}
				}
			} else {
				return targetValue;
			}
		}
	});
}

module.exports = ModelPs;
