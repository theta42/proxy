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

	return {post: post, get: get}
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
			return app.api.get('users/me', function(error, data){
				return callack(error, data.username);
			})
		}else{
			callack(false, false);
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

	return {
		getToken: getToken,
		isLoggedIn: isLoggedIn,
		logIn:logIn
	}

})(app);

app.users = (function(app){
	function createInvite(callack){
		app.api.post('users/invite', function(error, data, status){
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
})(app);

app.hosts = (function(app){
	function list(callack){
		app.api.get('hosts/?detail=true', function(error, data){
			callack(error, data.hosts)
		});
	}

	function get(host, callack){
		app.api.get('hosts/' + host, function(error, data){
			callack(error, data)
		});
	}

	function add(args, callack){
		app.api.post('hosts/', args, function(error, data){
			callack(error, data);
		});
	}

	return {
		list: list,
		get: get,
		add: add
	}
})(app);

app.util = (function(app){

	function getUrlParameter(name) {
	    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	    var results = regex.exec(location.search);
	    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};

	function actionMessage(message, $target){
		$target = $target || $('div.actionMessage');

		if($target.html() === message) return;

		if($target.html()){
			$target.slideUp('fast', function(){
				$target.html('')
				if(message) actionMessage(message);
			})
			return;
		}else{
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
	var $form = $(btn).closest( '[action]' ), // gets the 'form' parent
		str = $form.find( '[name]' ).serialize(); // builds query string
	/*if( !$form.validate(
		{
			form: {
				alertCount: true,
				alertCountMessage: " errors found on this form!"
			}
		}) ) {
		return false;
	}*/
	if( del ){ // delete request 
		if( confirm( 'Are you sure?' ) ) {
			str += "&deleteThis=true"; // adds delete to query string
		}else{
			event.preventDefault(); // avoid to execute the actual submit of the form
			return false; //cancels function
		}
	}

	$.post( $form.attr( 'action' ), str, function ( data ) { // sends post data to server validate 
		tableAJAX( data.action_message ); //re-populate table
	});

	eval( $form.attr( 'evalAJAX' ) ); //gets JS to run after completion
	event.preventDefault(); // avoid to execute the actual submit of the form.
	return false; // avoid to execute the actual submit of the form.
}
