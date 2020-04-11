var app = {};

app.api = (function(app){
	var baseURL = '/api/'

	function post(url, data, callack){
		$.ajax({
			type: 'POST',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			data: JSON.stringify(data),
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callack(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	function put(url, data, callack){
		$.ajax({
			type: 'PUT',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			data: JSON.stringify(data),
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callack(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	function remove(url, callack){
		$.ajax({
			type: 'delete',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callack(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	function get(url, callack){
		$.ajax({
			type: 'GET',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callack(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	return {post: post, get: get, put: put, delete: remove}
})(app)

app.auth = (function(app) {
	function setToken(token){
		localStorage.setItem('APIToken', token);
	}

	function getToken(){
		return localStorage.getItem('APIToken');
	}

	function isLoggedIn(callack){
		if(getToken()){
			return app.api.get('user/me', function(error, data){
				return callack(error, data.username);
			})
		}else{
			callack(null, false);
		}
	}

	function logIn(args, callack){
		app.api.post('auth/login', args, function(error, data){
			if(data.login){
				setToken(data.token);
			}
			callack(error, !!data.token);
		});
	}

	function logOut(){
		localStorage.removeItem('APIToken');
	}

	return {
		getToken: getToken,
		isLoggedIn: isLoggedIn,
		logIn: logIn,
		logOut: logOut,
	}

})(app);

app.user = (function(app){
	function list(callack){
		app.api.get('user/?detail=true', function(error, data){
			callack(error, data);
		})
	}

	function add(args, callack){
		app.api.post('user/', args, function(error, data){
			callack(error, data);
		});
	}

	function remove(args, callack){
		app.api.delete('user/'+ args.username, function(error, data){
			callack(error, data);
		});
	}

	function changePassword(args, callack){
		app.api.put('users/'+ arg.username || '', args, function(error, data){
			callack(error, data);
		});
	}

	function createInvite(callack){
		app.api.post('user/invite', function(error, data, status){
			callack(error, data.token);	
		});
	}

	function consumeInvite(args){
		app.api.post('/auth/invite/'+args.token, args, function(error, data){
			if(data.token){
				app.auth.setToken(data.token)
				return callack(null, true)
			}
			callack(error)
		});
	}

	return {list, remove};

})(app);

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

app.util = (function(app){

	function getUrlParameter(name) {
	    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	    var results = regex.exec(location.search);
	    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};

	function actionMessage(message, options){
		options = options || {};
		$target = options.$target || $('div.actionMessage');
		message = message || '';

		if($target.html() === message) return;

		if($target.html()){
			$target.slideUp('fast', function(){
				$target.html('')
				if(message) actionMessage(message, options);
			})
			return;
		}else{
			if(options.type) $target.addClass('alert-' + options.type);
			$target.html(message).slideDown('fast');
		}
	}

	$.fn.serializeObject = function() {
	    var 
	        arr = $(this).serializeArray(), 
	        obj = {};
	    
	    for(var i = 0; i < arr.length; i++) {
	        if(obj[arr[i].name] === undefined) {
	            obj[arr[i].name] = arr[i].value;
	        } else {
	            if(!(obj[arr[i].name] instanceof Array)) {
	                obj[arr[i].name] = [obj[arr[i].name]];
	            }
	            obj[arr[i].name].push(arr[i].value);
	        }
	    }
	    return obj;
	};

	return {
		getUrlParameter: getUrlParameter,
		actionMessage: actionMessage
	}
})(app);

$.holdReady( true );
if(!location.pathname.includes('/login')){
	app.auth.isLoggedIn(function(error, isLoggedIn){
		if(error || !isLoggedIn){
			location.replace('/login/?redirect='+location.pathname);
		}else{
			$.holdReady( false );
		}
	})
}else{
	$.holdReady( false );
}

$( document ).ready( function () {

	$( 'div.row' ).fadeIn( 'slow' ); //show the page

	//panel button's
	$( '.glyphicon-circle-arrow-down' ).click( function () {
		$( this ).closest( '.panel-heading' ).siblings( '.panel-body' ).slideToggle( 'fast' );
	});
	$( '.glyphicon-remove-circle' ).click( function () {
		$( this ).closest( 'div.panel' ).slideUp( 'fast' );
	});
	$( '.glyphicon-refresh' ).each( function () {
		$(this).click( function () {
			tableAJAX();
		});
	});
});

//ajax form submit
function formAJAX( btn, del ) {
	event.preventDefault(); // avoid to execute the actual submit of the form.
	var $form = $(btn).closest( '[action]' ); // gets the 'form' parent
	var formData = $form.find( '[name]' ).serializeObject(); // builds query formDataing
	var method = $form.attr('method') || 'post';

	console.log('formAJAX method', method)

	if( !$form.validate(
		{
			form: {
				alertCount: true,
				alertCountMessage: " errors found on this form!"
			}
		}) ) {
		return false;
	}

	app.api[method]($form.attr( 'action' ), formData, function(error, data){
		tableAJAX( data.message ); //re-populate table
		eval( $form.attr( 'evalAJAX' ) ); //gets JS to run after completion
	});

}
