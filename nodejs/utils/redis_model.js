'use strict';

const client = require('../utils/redis');
const objValidate = require('../utils/object_validate');


let table = {};

table.get = async function(data){
	try{
		// if the data argument was passed as the index key value, make a data
		// object and add the index key to it.
		if(typeof data !== 'object'){
			let key = data;
			data = {};
			data[this._key] = key;
		}

		// Get all the hash keys for the passed index key.
		let res = await client.HGETALL(`${this._name}_${data[this._key]}`);

		// If the redis query resolved to something, prepare the data.
		if(res){

			// Redis always returns strings, use the keyMap schema to turn them
			// back to native values.
			res = objValidate.parseFromString(this._keyMap, res);

			// Make sure the index key in in the returned object.
			res[this._key] = data[this._key];

			// Create a instance for this redis entry.
			var entry = Object.create(this);

			// Insert the redis response into the instance.
			Object.assign(entry, res);

			// Return the instance to the caller.
			return entry;
		}

	}catch(error){
		throw error
	}

	let error = new Error('EntryNotFound');
	error.name = 'EntryNotFound';
	error.message = `${this._name}:${data[this._key]} does not exists`;
	error.status = 404;
	throw error;
};

table.exists = async function(data){
	// Return true or false if the requested entry exists ignoring error's.
	try{
		await this.get(data);

		return true
	}catch(error){
		return false;
	}
};

table.list = async function(){
	// return a list of all the index keys for this table.
	try{

		return await client.SMEMBERS(this._name);

	}catch(error){
		throw error;
	}
};

table.listDetail = async function(){
	// Return a list of the entries as instances.
	let out = [];

	for(let entry of await this.list()){
		out.push(await this.get(entry));
	}

	return out
};

table.add = async function(data, noMemberAdd){
	// Add a entry to this redis table.
	try{

		// Validate the passed data by the keyMap schema.

		data = objValidate.processKeys(this._keyMap, data);

		// Do not allow the caller to overwrite an existing index key,
		if(data[this._key] && await this.exists(data)){
			let error = new Error('EntryNameUsed');
			error.name = 'EntryNameUsed';
			error.message = `${this._name}:${data[this._key]} already exists`;
			error.status = 409;

			throw error;
		}

		// Add the key to the members for this redis table
		if(!noMemberAdd) await client.SADD(this._name, data[this._key]);

		// Add the values for this entry.
		for(let key of Object.keys(data)){
			await client.HSET(`${this._name}_${data[this._key]}`, key, data[key]);
		}

		// return the created redis entry as entry instance.
		return await this.get(data[this._key]);
	} catch(error){
		throw error;
	}
};

table.update = async function(data, key){
	// Update an existing entry.
	try{
		// If an index key is passed, we assume is passed, assume we are not
		// part of an entry instance. Make one and recall this from from a entry
		// instance,
		if(key) return await (await this.get(key)).update(data);

		// Check to see if entry name changed.
		if(data[this._key] && data[this._key] !== this[this._key]){

			// Merge the current data into with the updated data 
			let newData = Object.assign({}, this, data);

			// Remove the updated failed so it doesnt keep it
			delete newData.updated;

			// Create a new record for the updated entry. If that succeeds,
			// delete the old recored
			if(await this.add(newData)) await this.remove();

		}else{
			// Update what ever fields that where passed.

			// Validate the passed data, ignoring required fields.
			data = objValidate.processKeys(this._keyMap, data, true);
			
			// Loop over the data fields and apply them to redis
			for(let key of Object.keys(data)){
				this[key] = data[key];
				await client.HSET(`${this._name}_${this[this._key]}`, key, data[key]);
			}
		}

		return this;
	
	} catch(error){
		// Pass any error to the calling function
		throw error;
	}
};

table.remove = async function(data){
	// Remove an entry from this table.

	data = data || this;
	try{
		// Remove the index key from the tables members list.
		await client.SREM(this._name, data[this._key]);

		// Remove the entries hash values.
		let count = await client.DEL(`${this._name}_${data[this._key]}`);

		// Return the number of removed values to the caller.
		return count;

	} catch(error) {
		throw error;
	}
};

function Table(data){
	// Create a table instance.
	let instance = Object.create(data);
	Object.assign(instance, table);

	// Return the table instance to the caller.
	return Object.create(instance);

};

module.exports = Table;
