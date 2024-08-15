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
	hisroty = []
	constructor(orgin){
		this.orgin = orgin
		this.hisroty.push(orgin.constructor.name);
	}

	static isNotCycle(modleName, queryHelper){
		if(queryHelper instanceof this){
			if(queryHelper.hisroty.includes(modleName)){
				return true;
			}
			queryHelper.hisroty.push(modleName)
		}
	}
}

class Table{
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
		}
	}

	static redisClient = client;

	static models = {}
	static register = function(Model){
		Model = Model || this;
		this.models[Model.name] = Model;
	}
	
	constructor(data){
		for(let key in data){
			this[key] = data[key];
		}
	}

	static async get(index, queryHelper){
		try{
			if(typeof index === 'object'){
				index = index[this._key];
			}

			let result = await client.HGETALL(
				redisPrefix(`${this.prototype.constructor.name}_${index}`)
			);

			if(!Object.keys(result).length){
				let error = new Error('EntryNotFound');
				error.name = 'EntryNotFound';
				error.message = `${this.prototype.constructor.name}:${index} does not exists`;
				error.status = 404;
				throw error;
			}

			// Redis always returns strings, use the keyMap schema to turn them
			// back to native values.
			result = objValidate.parseFromString(this._keyMap, result);

			let instance = new this(result);
			await instance.buildRelations(queryHelper);
			
			return instance;
		}catch(error){
			throw error;
		}
	}

	async buildRelations(queryHelper){

		for(let [key, options] of Object.entries(this.constructor._keyMap)){
			if(options.model){
				let remoteModel = this.constructor.models[options.model]
				try{
					if(QueryHelper.isNotCycle(remoteModel.name, queryHelper)) continue;
					if(options.rel === 'one'){
						// console.log('relone:', this[key], queryHelper, remoteModel, await remoteModel.get(this[key], queryHelper || new QueryHelper(this)))
						this[key] = await remoteModel.get(this[key] || this[options.localKey || this.constructor._key] , queryHelper || new QueryHelper(this))
					}
					if(options.rel === 'many'){
						this[key] = await remoteModel.listDetail({
							[options.remoteKey]: this[options.localKey || this.constructor._key],
						},queryHelper || new QueryHelper(this))

					}
				}catch{}
			}
		}
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

	static findall(...args){
		return this.listDetail(...args);
	}

	static async create(data){
		// Add a entry to this redis table.
		try{

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
			data = objValidate.processKeys(this.constructor._keyMap, data, true);
			
			// Check to see if entry name changed.
			if(data[this.constructor._key] && data[this.constructor._key] !== this[this.constructor._key]){
				// Remove the index key from the tables members list.
				
				if(data[this.constructor._key] && await this.constructor.exists(data)){
					let error = new Error('EntryNameUsed');
					error.name = 'EntryNameUsed';
					error.message = `${this.constructor.name}:${data[this.constructor._key]} already exists`;
					error.keys = [{
						key: this.constructor._key,
						message: `${this.constructor.name}:${data[this.constructor._key]} already exists`
					}]
					error.status = 409;

					throw error;
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

	toJSON(){
		let result = {};
		for (const [key, value] of Object.entries(this)) {
			if(this.constructor._keyMap[key] && this.constructor._keyMap[key].isPrivate) continue;
			result[key] = value;
		}

		return result

		// return JSON.stringify(result);
	}

	toString(){
		return this[this.constructor._key];
	}

}


module.exports = Table;