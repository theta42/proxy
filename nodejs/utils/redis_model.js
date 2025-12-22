'use strict';

const {createClient} = require('redis');
const objValidate = require('../utils/object_validate');
const conf = require('../conf');

const client = createClient({});
client.connect();

function redisPrefix(key){
	return `${conf.redis.prefix}${key}`;
}

class QueryHelper{
	hisroty = [];
	constructor(orgin){
		this.orgin = orgin;
		this.hisroty.push(orgin.constructor.name);
	}

	static isNotCycle(modleName, queryHelper){
		if(queryHelper instanceof this){
			if(queryHelper.hisroty.includes(modleName)){
				return true;
			}
			queryHelper.hisroty.push(modleName);
		}
	}
}

class Model{
	static errors = {
		ObjectValidateError: objValidate.ObjectValidateError,
		EntryNameUsed: ()=>{
			let error = new Error('EntryNameUsed');
			error.name = 'EntryNameUsed';
			error.message = `${this.prototype.constructor.name}:${data[this._key]} already exists`;
			error.keys = [{
				key: this._key,
				message: `${this.prototype.constructor.name}:${data[this._key]} already exists`
			}]
			error.status = 409;

			return error;
		},
		EntryNotFound: (index)=>{
			let error = new Error('EntryNotFound');
			error.name = 'EntryNotFound';
			error.message = `${this.name}:${index} does not exists`;
			error.status = 404;

			return error;
		},
		EntryNameUsed: (data)=>{
			let error = new Error('EntryNameUsed');
			error.name = 'EntryNameUsed';
			error.message = `${this.constructor.name}:${data[this.constructor._key]} already exists`;
			error.keys = [{
				key: this.constructor._key,
				message: `${this.constructor.name}:${data[this.constructor._key]} already exists`
			}]
			error.status = 409;

			return error;
		},
	}

	static models = {}

	static register = function(Model, proxy){
		Model = Model || this;
		if(proxy){
			Model.__proxy = proxy;
			Model = proxy(Model);
		}

		this.models[Model.name] = Model;
	}
	
	constructor(data){
		for(let key in data){
			this[key] = data[key];
		}
	}

	async buildRelations(queryHelper){
		
		if(Object.values(this.constructor._keyMap).some(i=>i.extends)){
			for(let [key, options] of Object.entries(this.constructor._keyMap)){
				if(options.extends){
					if(this.constructor.__extendedModels && this[key] && !this.constructor.__isExtended){
						return this.constructor.__extendedModels[key][this[key]]
					}
				}
			}
		}

		// Loop over all the fields from the schema, matching any that have a
		// relationship.
		for(let [key, options] of Object.entries(this.constructor._keyMap)){
			if(options.model){
				let remoteModel = this.constructor.models[options.model]
				try{

					// Test if we are in a lookup cycle and bale if we are.
					if(QueryHelper.isNotCycle(remoteModel.name, queryHelper)) continue;

					// Swap the relationship key with the built relationship
					if(options.rel === 'one'){

						this[key] = await remoteModel.get(
							this[key] || this[options.localKey || this.constructor._key] ,
							queryHelper || new QueryHelper(this)
						);
					}
					if(options.rel === 'many'){
						this[key] = await remoteModel.listDetail({
							[options.remoteKey]: this[options.localKey || this.constructor._key],
						},queryHelper || new QueryHelper(this));

						// Add a method to this instance to add values to the
						// current many 
						this[`${key}Create`] = async (data, ...args)=>{
							let item = await remoteModel.create({
								...data,
								[options.remoteKey]: this[options.localKey || this.constructor._key],
							})

							this[key].push(item);
							this.update();

							return this;
						}

						// do this better...
						this.remove = (()=>{
							let currentRemove = this.remove;
							return async (data, ...args)=>{
								try{
									for(let item of this[key]){
										await item.remove();
									}
								}catch{}
								return await currentRemove.call(this, data, ...args);
							}
						})()

					}
					// if(options.rel === 'manyToMany'){
					// 	// Make through table
					// 	let nameSort = [options.model, this.constructor.name];
					// 	let name = nameSort.sort().join('_join_');

					// 	if(!this.constructor.models[name]){
					// 		this.constructor.models[name] = ({
					// 			[name] : class extends Model {
					// 				static _keyMap = {
					// 					'created_on': {default: function(){return (new Date).getTime()}},
					// 					`${options.model}_key`: {type: 'string', isRequired: true}
					// 					`${this.constructor.name}_key`: {type: 'string', isRequired: true}
					// 				}
					// 			}
					// 		})[name];
					// 	}

					// 	remoteModel = this.constructor.models[name];

					// 	this[key] = await remoteModel.findall({
					// 		`${this.constructor.name}_key`: this[options.localKey || this.constructor._key]
					// 	})

					// }
				}catch(error){
					console.log('buildRelations error', error)
				}
			}
		}
	}

	static extend(key, Model){
		if(!this.__extendedModels) this.__extendedModels = {};
		if(!this.__extendedModels[key]) this.__extendedModels[key] = {};

		let originalKeyMap = Object.assign({}, Model._keyMap);
		let _keyMap = {...this._keyMap, ...Model._keyMap};

		let parentModel = this;

		let cls = ({
			[this.name] : class extends Model {
				static _keyMap = _keyMap;
				static _originalKeyMap = originalKeyMap;
				static __isExtended = true;
				static __orginalMethods = Object.getOwnPropertyNames(Model);

				static toJSON(){
					return {
						fields: this._originalKeyMap,
						name: Model.name,
						...super.toJSON(),
					};
				};

				static async get(...args){
					let instance = await super.get(...args);
					if(parentModel.__proxy){
						instance = parentModel.__proxy(instance);
					}
					return instance;
				}
			}
		})[this.name];

		this.__extendedModels[key][Model.name] = cls;
	}

	static async __buildInstance(data, queryHelper){
		let instance = new this(data);
		let newThis = await instance.buildRelations(queryHelper);
		if(newThis) return await newThis.get(data, queryHelper);
		
		return instance;
	}
}

class Table extends Model{
	static modelBacking = Table;
	static redisClient = client;

	static async get(data, queryHelper){
		try{
			let index;
			if(typeof data === 'object'){
				if('type' in data){
					return await this.__buildInstance(data, queryHelper);
				}
				index = data[this._key];
			}else{
				index = data;
			}

			let result = await client.HGETALL(
				redisPrefix(`${this.name}_${index}`)
			);

			if(!Object.keys(result).length) throw this.errors.EntryNotFound(index)

			// Redis always returns strings, use the keyMap schema to turn them
			// back to native values.
			result = objValidate.parseFromString(this._keyMap, result);

			return await this.__buildInstance(result, queryHelper);

		}catch(error){
			throw error;
		}
	}

	static async list(){
		// return a list of all the index keys for this table.
		try{
			return await client.SMEMBERS(
				redisPrefix(this.prototype.constructor.name)
			);

		}catch(error){
			throw error;
		}
	}

	static async listDetail(options, queryHelper){

		// Return a list of the entries as instances.
		let out = [];

		for(let entry of await this.list()){
			let instance = await this.get(entry, arguments[arguments.length - 1]);
			if(!options) out.push(instance);
			let matchCount = 0;
			for(let option in options){
				if(instance[option] === options[option] && ++matchCount === Object.keys(options).length){
					out.push(instance);
					break;
				}
			}
		}

		return out;
	}

	static async exists(index){
		if(typeof index === 'object'){
			index = index[this._key];
		}

		return await client.SISMEMBER(
			redisPrefix(this.prototype.constructor.name),
			index
		);
	}

	static findall(...args){
		return this.listDetail(...args);
	}

	static async create(data){
		// Add a entry to this redis table.
		try{

			// See if this can have an class has a key that calls for the model
			// to be extended.
			for(let [key, options] of Object.entries(this._keyMap)){
				if(options.extends){
					if(this.__extendedModels && data[key] && !this.__isExtended){
						return await this.__extendedModels[key][data[key]].create(data)
					}
				}
			}

			// Validate the passed data by the keyMap schema.
			data = objValidate.processKeys(this._keyMap, data);

			// Do not allow the caller to overwrite an existing index key,
			if(data[this._key] && await this.exists(data)){
				let error = new Error('EntryNameUsed');
				error.name = 'EntryNameUsed';
				error.message = `${this.prototype.constructor.name}:${data[this._key]} already exists`;
				error.keys = [{
					key: this._key,
					message: `${this.prototype.constructor.name}:${data[this._key]} already exists`
				}]
				error.status = 409;

				throw error;
			}

			// Add the key to the members for this redis table
			await client.SADD(
				redisPrefix(this.prototype.constructor.name),
				data[this._key]
			);

			// Add the values for this entry.
			for(let key of Object.keys(data)){
				if(data[key] === undefined) continue;
				await client.HSET(
					redisPrefix(`${this.prototype.constructor.name}_${data[this._key]}`), 
					key,
					objValidate.parseToString(data[key])
				);
			}

			// return the created redis entry as entry instance.
			return await this.get(data[this._key]);
		} catch(error){
			throw error;
		}
	}

	async update(data, key){
		// Update an existing entry.
		try{
			// Validate the passed data, ignoring required fields.
			data = objValidate.processKeys(this.constructor._keyMap, data || {}, true);
			
			// Check to see if entry name changed.
			if(data[this.constructor._key] && data[this.constructor._key] !== this[this.constructor._key]){
				// Remove the index key from the tables members list.
				
				if(data[this.constructor._key] && await this.constructor.exists(data)){
					throw this.constructor.errors.EntryNameUsed(data);
				}

				await client.SREM(
					redisPrefix(this.constructor.name),
					this[this.constructor._key]
				);

				// Add the key to the members for this redis table
				await client.SADD(
					redisPrefix(this.constructor.name),
					data[this.constructor._key]
				);

				await client.RENAME(
					redisPrefix(`${this.constructor.name}_${this[this.constructor._key]}`),
					redisPrefix(`${this.constructor.name}_${data[this.constructor._key]}`),
				);

			}
			// Update what ever fields that where passed.

			// Loop over the data fields and apply them to redis
			for(let key of Object.keys(data)){
				this[key] = data[key];
				await client.HSET(
					redisPrefix(`${this.constructor.name}_${this[this.constructor._key]}`),
					key, String(data[key])
				);
			}
			
			return this;
		
		} catch(error){
			// Pass any error to the calling function
			throw error;
		}
	}

	async remove(data){
		// Remove an entry from this table.

		try{
			// Remove the index key from the tables members list.
			await client.SREM(
				redisPrefix(this.constructor.name),
				this[this.constructor._key]
			);

			// Remove the entries hash values.
			let count = await client.DEL(
				redisPrefix(`${this.constructor.name}_${this[this.constructor._key]}`)
			);

			// Return the number of removed values to the caller.
			return this;

		} catch(error) {
			throw error;
		}
	};

	static toJSON(){
		return {
			name: this.name,
			fields: this._keyMap,
			pk: this._key,
			extend: this.__extendedModels ? this.__extendedModels[Object.keys(this.__extendedModels)[0]] : undefined,
		}
	}

	toJSON(){
		// Remove any value that is marked private
		let result = {};
		for (const [key, value] of Object.entries(this)) {
			if(this.constructor._keyMap[key] && this.constructor._keyMap[key].isPrivate) continue;
			result[key] = value;
		}

		return result
	}

	toString(){
		return this[this.constructor._key];
	}
}


module.exports = Table;
