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

// Host / target validation, mirrored from the backend (utils/hostname_validate.js):
// a bare hostname or IPv4 address, no protocol / "/" / ":" / whitespace. The
// incoming host may be a wildcard ("*.example.com"); the target may not.
// Proxy-specific, so it's registered here (via @simpleworkjs/frontend's
// $.validateSettings) rather than in the shared package's generic rule set.
(function(){
	var LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
	// Either one bare label (Docker service names, /etc/hosts entries) or a
	// dotted hostname with an alphabetic TLD.
	var HOSTNAME = /^(?=.{1,253}$)(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/i;
	var FORBIDDEN = /[\s/:]/;

	function isIPv4( value ) {
		var parts = value.split( '.' );
		if ( parts.length !== 4 ) return false;
		return parts.every( function( p ) {
			return /^(0|[1-9]\d{0,2})$/.test( p ) && Number( p ) <= 255;
		});
	}

	// Incoming-host pattern: labels may be normal, "*" (one fragment), or "**"
	// (any number of fragments, incl. a bare "**" global catch-all).
	function isHostPattern( value ) {
		if ( value.length > 253 ) return false;
		return value.split( '.' ).every( function( l ) {
			return l === '*' || l === '**' || LABEL.test( l );
		});
	}

	function forbidden( value ) {
		return FORBIDDEN.test( value ) || value.includes( '://' );
	}

	// Incoming host: IPv4 or a wildcard host pattern.
	function checkHost( value ) {
		if ( typeof value !== 'string' || value.length === 0 ) return "Required";
		if ( forbidden( value ) ) return 'No protocol, "/", or ":"';
		if ( isIPv4( value ) || isHostPattern( value ) ) return;
		return "Enter a valid host or wildcard (*, **)";
	}

	// Downstream target: IPv4 or a strict hostname, no wildcard.
	function checkTarget( value ) {
		if ( typeof value !== 'string' || value.length === 0 ) return "Required";
		if ( forbidden( value ) ) return 'No protocol, "/", or ":"';
		if ( isIPv4( value ) || HOSTNAME.test( value ) ) return;
		return "Enter a valid hostname or IP";
	}

	$.validateSettings({
		rule:{
			// Incoming host name — hostname, IPv4, or wildcard pattern (*, **).
			host: function( value ) {
				return checkHost( value );
			},

			// Downstream target — hostname or IPv4, no wildcard.
			target: function( value ) {
				return checkTarget( value );
			},

			// Back-compat alias (no wildcard).
			hostname: function( value ) {
				return checkTarget( value );
			},
		}
	});
})();
