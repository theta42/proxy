app.host = (function(app){
	function list(callack){
		app.api.get('host/?detail=true', function(error, data){
			callack(error, data.hosts)
		});
	}

	function get(host, callack){
		app.api.get('host/' + host, function(error, data){
			callack(error, data)
		});
	}

	function add(args, callack){
		app.api.post('host/', args, function(error, data){
			callack(error, data);
		});
	}

	function edit(args, callack){
		app.api.put('host/' + args.edit_host, args, function(error, data){
			callack(error, data);
		});
	}

	function remove(args, callack){
		app.api.delete('host/'+ args.host, function(error, data){
			callack(error, data);
		});
	}

	function getCert(args, callack){
		app.api.get('cert/'+args.host, function(error, data){
			callack(error, data);
		});
	}

	function clearCache(callack){
		app.api.delete('host/cache', function(error, data){
			callack(error, data);
		});
	}

	return {
		getCert,
		list: list,
		get: get,
		add: add,
		edit: edit,
		remove: remove,
		clearCache: clearCache,
	}
})(app);

app.apiToken = (function(app){
	function list(callback){
		app.api.get('api-token/', function(error, data){
			callback(error, data);
		});
	}

	function get(id, callback){
		app.api.get('api-token/' + id, function(error, data){
			callback(error, data);
		});
	}

	function add(args, callback){
		app.api.post('api-token/', args, function(error, data){
			callback(error, data);
		});
	}

	function update(args, callback){
		app.api.put('api-token/' + args.id, args, function(error, data){
			callback(error, data);
		});
	}

	function remove(args, callback){
		app.api.delete('api-token/' + args.id, function(error, data){
			callback(error, data);
		});
	}

	function rotate(args, callback){
		app.api.post('api-token/' + args.id + '/rotate', {}, function(error, data){
			callback(error, data);
		});
	}

	return {list, get, add, update, remove, rotate};
})(app);
