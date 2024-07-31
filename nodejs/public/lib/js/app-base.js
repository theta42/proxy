var app = {};

app.pubsub = (function(){
	app.topics = {};

	app.subscribe = function(topic, listener){
		if(topic instanceof RegExp){
			listener.match = topic;
			topic = "__REGEX__";
		}

		// create the topic if not yet created
		if(!app.topics[topic]) app.topics[topic] = [];

		// add the listener
		app.topics[topic].push(listener);
	}

	app.matchTopics = function(topic){
		topic = topic || '';
		var matches = [... app.topics[topic] ? app.topics[topic] : []];

		if(!app.topics['__REGEX__']) return matches;

		for(var listener of app.topics['__REGEX__']){
			if(topic.match(listener.match)) matches.push(listener);
		}

		return matches;
	}

	app.publish = function(topic, data){

		// send the event to all listeners
		app.matchTopics(topic).forEach(function(listener){
			setTimeout(function(data, topic){
					listener(data || {}, topic);
				}, 0, data, topic);
		});
	}

	return this;
})(app);

app.socket = (function(app){
	// $.getScript('/socket.io/socket.io.js')
	// <script type="text/javascript" src="/socket.io/socket.io.js"></script>
	
	var socket;
	$(document).ready(function(){
		socket = io({
			auth: {
				token: app.auth.getToken()
			}
		});
		// socket.emit('chat message', $('#m').val());
		socket.on('P2PSub', function(msg){
			msg.data.__noSocket	= true;
			app.publish(msg.topic, msg.data);
		});

		app.subscribe(/./g, function(data, topic){
		  // console.log('local_pubs', data, topic)
		  if(data.__noSocket) return;
		  // console.log('local_pubs 2', data, topic)

		  socket.emit('P2PSub', { topic, data });
		});
	})

	return socket;

})(app);

app.api = (function(app){
	var baseURL = '/api/'

	function post(url, data, callback){
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
				callback(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	function put(url, data, callback){
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
				callback(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	function remove(url, callback, callback2){
		if(!$.isFunction(callback)) callback = callback2;
		$.ajax({
			type: 'delete',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callback(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	function get(url, callback){
		$.ajax({
			type: 'GET',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callback(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				)
			}
		});
	}

	return {post: post, get: get, put: put, delete: remove}
})(app)

app.auth = (function(app){
	var user = {}
	function setToken(token){
		localStorage.setItem('APIToken', token);
	}

	function getToken(){
		return localStorage.getItem('APIToken');
	}

	function isLoggedIn(callback){
		if(getToken()){
			return app.api.get('user/me', function(error, data){
				if(!error) app.auth.user = data;
				return callback(error, data);
			});
		}else{
			callback(null, false);
		}
	}

	function logIn(args, callback){
		app.api.post('auth/login', args, function(error, data){
			if(data.login){
				setToken(data.token);
			}
			callback(error, !!data.token);
		});
	}

	function logOut(callback){
		localStorage.removeItem('APIToken');
		callback();
	}

	function forceLogin(){
		$.holdReady(true);
		app.auth.isLoggedIn(function(error, isLoggedIn){
			if(error || !isLoggedIn){
				app.auth.logOut(function(){})
				location.replace(`/login${location.href.replace(location.origin, '')}`);
			}else{
				$.holdReady(false);
			}
		});
	}

	function logInRedirect(){
		window.location.href = location.href.replace(location.origin+'/login', '') || '/'
	}

	return {
		getToken: getToken,
		setToken: setToken,
		isLoggedIn: isLoggedIn,
		logIn: logIn,
		logOut: logOut,
		forceLogin,
		logInRedirect,
	}

})(app);

app.user = (function(app){
	function list(callback){
		app.api.get('user/?detail=true', function(error, data){
			callback(error, data);
		})
	}

	function add(args, callback){
		app.api.post('user/', args, function(error, data){
			callback(error, data);
		});
	}

	function remove(args, callback){
		app.api.delete('user/'+ args.username, function(error, data){
			callback(error, data);
		});
	}

	function changePassword(args, callback){
		app.api.put('users/'+ arg.username || '', args, function(error, data){
			callback(error, data);
		});
	}

	return {list, remove};

})(app);

app.util = (function(app){

	function getUrlParameter(name){
	    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	    var results = regex.exec(location.search);
	    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};

	function actionMessage(message, $target, type, callback){
		message = message || '';
		$target = $target.closest('div.card').find('.actionMessage');
		type = type || 'info';
		callback = callback || function(){};

		if($target.html() === message) return;

		if($target.html()){
			$target.slideUp('fast', function(){
				$target.html('')
				$target.removeClass (function(index, className){
					return (className.match (/(^|\s)bg-\S+/g) || []).join(' ');
				});
				if(message) return actionMessage(message, $target, type, callback);
				$target.hide()
			})
		}else{
			if(type) $target.addClass('bg-' + type);
			message = '<span class="align-middle">' + message + '</span><button class="action-close btn btn-sm btn-outline-dark float-right"><i class="fa-solid fa-xmark"></i></button>'
			$target.html(message).slideDown('fast');
		}
		setTimeout(callback,10)
	}

	$.fn.serializeObject = function(){
	    var 
	        arr = $(this).serializeArray(), 
	        obj = {};
	    
	    for(var i = 0; i < arr.length; i++){
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

$( document ).ready(function(){
	$('div.row').fadeIn('slow'); //show the page

	//panel button's
	$('.fa-arrows-v').click(function(){
		$(this).closest('.card').find('.card-body').slideToggle('fast');
	});

	$('.fa-circle-minus').click(function(){
		$(this).closest('.card').find('.card-body').slideToggle('fast');
	});

	$('.fa-circle-xmark').click(function(){
		$(this).closest('.card').slideUp('fast');
	});

	$('.actionMessage').on('click', 'button.action-close', function(event){
		app.util.actionMessage(null, $(this));
	});

	setInterval(()=>{
		$('.momentFromNow').each((idx,el)=>{
			var $el = $(el);
			try{
				$el.html(moment($(el).data('date')).fromNow());
			}catch{}
		})
	}, 30000,);
});

//ajax form submit
function formAJAX(btn, del){
	event.preventDefault(); // avoid to execute the actual submit of the form.
	var $form = $(btn).closest('[action]'); // gets the 'form' parent
	var formData = $form.find('[name]').serializeObject(); // builds query formDataing
	var method = $form.attr('method') || 'post';

	// if( !$form.validate()){
	// 	app.util.actionMessage('Please fix the form errors.', $form, 'danger')
	// 	return false;
	// }
	
	app.util.actionMessage( 
		'<div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div>',
		$form,
		'info'
	);

	app.api[method]($form.attr('action'), formData, function(error, data){
		app.util.actionMessage(data.message, $form, error ? 'danger' : 'success'); //re-populate table
		if(!error){
			$form.trigger("reset");
			eval($form.attr('evalAJAX')); //gets JS to run after completion
		}
	});
}
