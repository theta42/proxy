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
		})
	}

	return {
		list: list,
		get: get,
		add: add,
		edit: edit,
		remove: remove,
	}
})(app);
