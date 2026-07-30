// Shared client framework for the theta42 apps.
//
// This file is byte-identical across sso-manager-node, proxy and jump-host —
// per-app behaviour comes from the server (the `ui` locals in views/top.ejs and
// the /api/user/me response), never from edits to this file. Edit all three
// copies together.
//
// jQuery 4 safe: no $.isFunction, no $.holdReady.

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

	// post/put/delete are dual-mode: pass a callback for the node-style
	// (error, data, status) form, or omit it to get a Promise that resolves
	// with the parsed body and rejects with the error body. get/options return
	// the jqXHR, which is itself thenable, so `await app.api.get(...)` works.

	function body(method, url, data, callback){
		if(typeof callback !== 'function'){
			return new Promise(function(resolve, reject){
				$.ajax({
					type: method,
					url: baseURL+url,
					headers: { 'auth-token': app.auth.getToken() },
					data: JSON.stringify(data),
					contentType: 'application/json; charset=utf-8',
					dataType: 'json',
				}).done(resolve).fail(function(xhr){ reject(xhr.responseJSON || {}); });
			});
		}
		return $.ajax({
			type: method,
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
				);
			}
		});
	}

	function post(url, data, callback){
		return body('POST', url, data, callback);
	}

	function put(url, data, callback){
		return body('PUT', url, data, callback);
	}

	// Called both as (url, callback) and — from formAJAX, which always passes
	// the serialized form as the second argument — as (url, data, callback).
	// No request body is sent either way.
	function remove(url, data, callback){
		if(typeof data === 'function'){
			callback = data;
			data = undefined;
		}
		if(typeof callback !== 'function'){
			return new Promise(function(resolve, reject){
				$.ajax({
					type: 'DELETE',
					url: baseURL+url,
					headers: { 'auth-token': app.auth.getToken() },
					contentType: 'application/json; charset=utf-8',
					dataType: 'json',
				}).done(resolve).fail(function(xhr){ reject(xhr.responseJSON || {}); });
			});
		}
		return $.ajax({
			type: 'DELETE',
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
				);
			}
		});
	}

	function options(url, callback){
		return $.ajax({
			type: 'OPTIONS',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callback ? callback(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				) : function(){}
			}
		});
	}

	function get(url, callback){
		return $.ajax({
			type: 'GET',
			url: baseURL+url,
			headers:{
				'auth-token': app.auth.getToken()
			},
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: function(res, text){
				callback ? callback(
					text !== 'success' ? res.statusText : null,
					JSON.parse(res.responseText),
					res.status
				) : function(){}
			}
		});
	}

	return {post: post, get: get, put: put, delete: remove, options: options,}
})(app)

app.auth = (function(app){
	// One in-flight/cached GET /api/user/me per page load. Every gating
	// decision (nav items, per-view forceLogin, group-required elements) reads
	// this same promise instead of re-fetching.
	var userPromise = null;

	function setToken(token){
		localStorage.setItem('APIToken', token);
	}

	function getToken(){
		return localStorage.getItem('APIToken');
	}

	async function getUser(){
		try{
			return await app.api.get('user/me');
		}catch(error){
			if(error && error.status === 401) return null;
			throw error;
		}
	}

	// Cached current user, or false when there's no token at all. Callers that
	// need a fresh copy (after a login or a profile change) pass force.
	function loadUser(force){
		if(force || !userPromise){
			userPromise = getToken() ? getUser() : Promise.resolve(null);
			userPromise = userPromise.then(function(user){
				app.auth.user = app.auth.perms = user || null;
				return user;
			});
		}
		return userPromise;
	}

	// The apps report group membership two ways: sso-manager-node returns LDAP
	// DNs in `memberOf`, the OIDC clients return plain CNs in `groups`. Both
	// normalise to a list of CNs. `isAdmin` (the clients' effective-rights flag)
	// is exposed as a synthetic `admin` group so one gating model covers both.
	function groupCNs(user){
		var raw = (user && (user.memberOf || user.groups)) || [];
		if(!Array.isArray(raw)) raw = [raw];
		var names = raw.map(function(group){
			return String(group).split(',')[0].replace(/^cn=/i, '');
		});
		if(user && user.isAdmin && names.indexOf('admin') === -1) names.push('admin');
		return names;
	}

	async function memberOf(groupNameToFind, user){
		user = user || await loadUser();
		if(!user) return false;
		groupNameToFind = Array.isArray(groupNameToFind) ? groupNameToFind : [groupNameToFind];

		return groupCNs(user).some(function(group){
			return groupNameToFind.includes(group);
		});
	}

	// True when the logged-in user is a global admin (per user/me). Sync — only
	// meaningful once isLoggedIn/forceLogin has resolved.
	function isAdmin(){
		return !!(app.auth.perms && app.auth.perms.isAdmin);
	}

	// Dual-mode: returns a Promise resolving to the user (or false), and calls
	// an optional node-style callback with the same result.
	function isLoggedIn(callback){
		var promise = loadUser().then(function(user){
			return user || false;
		});

		if(typeof callback === 'function'){
			promise.then(function(user){
				callback(null, user);
			}, function(error){
				callback(error, false);
			});
		}

		return promise;
	}

	function logIn(args, callback){
		app.api.post('auth/login', args, function(error, data){
			if(data.login){
				setToken(data.token);
			}
			loadUser(true);
			callback(error, !!data.token);
		});
	}

	// Clears the session only — the caller decides where to go next (the nav's
	// Log Out button uses ui.logoutRedirect).
	function logOut(callback){
		localStorage.removeItem('APIToken');
		userPromise = null;
		app.auth.user = app.auth.perms = null;
		if(typeof callback === 'function') callback();
	}

	// Constrain a redirect target to a same-origin absolute path. Rejects
	// absolute URLs (open redirect), protocol-relative "//host" and "/\host",
	// and non-path schemes like "javascript:" (XSS). Falls back to "/".
	function safeInternalPath(path){
		if(typeof path !== 'string' || path.charAt(0) !== '/'
				|| path.charAt(1) === '/' || path.charAt(1) === '\\'){
			return '/';
		}
		return path;
	}

	// Consume an app token handed back by the OIDC callback via the URL
	// fragment (#token=…&redirect=…). Stores it, strips the fragment, and
	// forwards to the intended page. Returns true if a token was consumed.
	function consumeTokenFragment(){
		if(!location.hash) return false;
		var params = new URLSearchParams(location.hash.replace(/^#/, ''));
		var token = params.get('token');
		if(!token) return false;

		setToken(token);
		// redirect comes from the URL fragment (attacker-controllable); only
		// allow a same-origin path so it can't become an open redirect / XSS.
		var redirect = safeInternalPath(params.get('redirect') || '/');
		// Drop the token from the address bar before navigating on.
		history.replaceState(null, '', location.pathname + location.search);
		window.location.href = redirect;
		return true;
	}

	// Page-level gate. jQuery 4 removed $.holdReady, so an unauthenticated or
	// unauthorised user is kept off the page by a redirect / an error panel
	// rather than by pausing document ready.
	//
	// `requiredGroups` is a group CN or an OR-list of them; the synthetic
	// `admin` group covers the OIDC clients' isAdmin flag.
	async function forceLogin(requiredGroups){
		var user = await loadUser();

		if(!user){
			logOut(function(){});
			location.replace('/login?redirect=' + encodeURIComponent(
				location.pathname + location.search
			));
			return false;
		}

		if(user.onboardingRequired && location.pathname !== '/onboarding'){
			location.replace('/onboarding');
			return false;
		}

		if(requiredGroups && !await memberOf(requiredGroups, user)){
			app.messages.action(
				`<h1>
					<i class="fa-solid fa-triangle-exclamation"></i>
					<b>You do not have permission to be here.</b>
					<i class="fa-solid fa-triangle-exclamation"></i>
				</h1>`,
				$('#spa-shell'),
				'danger',
			);
			throw new Error("User does not have permission");
		}

		return user;
	}

	// Where to go after a successful login: the ?redirect= query param, or the
	// legacy /login/<path> suffix form, constrained to a same-origin path. The
	// suffix form keeps its query string — /login/oauth/authorize?client_id=…
	// is how the OIDC provider sends an unauthenticated user through login.
	function logInRedirect(){
		var params = new URLSearchParams(location.search);
		var target = params.get('redirect')
			|| location.href.replace(location.origin + '/login', '')
			|| '/';
		window.location.href = safeInternalPath(target);
	}

	return {
		getToken: getToken,
		setToken: setToken,
		getUser: getUser,
		loadUser: loadUser,
		groupCNs: groupCNs,
		memberOf: memberOf,
		isAdmin: isAdmin,
		isLoggedIn: isLoggedIn,
		safeInternalPath: safeInternalPath,
		consumeTokenFragment: consumeTokenFragment,
		user: null,
		perms: null,
		logIn: logIn,
		logOut: logOut,
		forceLogin,
		logInRedirect,
	}

})(app);

// Back-compat alias for views that awaited the cached user directly.
Object.defineProperty(app.auth, 'asyncUser', {
	get: function(){ return app.auth.loadUser(); },
});

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

// Local (app-managed) permissions and groups. Only the OIDC-client apps serve
// these endpoints; the calls are inert elsewhere.
app.permission = (function(app){
	function list(callback){
		app.api.get('permission/', function(error, data){
			callback(error, data);
		});
	}

	function subjects(callback){
		app.api.get('permission/subjects', function(error, data){
			callback(error, data);
		});
	}

	function add(args, callback){
		app.api.post('permission/', args, function(error, data){
			callback(error, data);
		});
	}

	function remove(id, callback){
		app.api.delete('permission/' + encodeURIComponent(id), function(error, data){
			callback(error, data);
		});
	}

	return {list, subjects, add, remove};

})(app);

app.group = (function(app){
	function list(callback){
		app.api.get('group/', function(error, data){
			callback(error, data);
		});
	}

	function add(args, callback){
		app.api.post('group/', args, function(error, data){
			callback(error, data);
		});
	}

	function remove(name, callback){
		app.api.delete('group/' + encodeURIComponent(name), function(error, data){
			callback(error, data);
		});
	}

	function addMember(name, username, callback){
		app.api.post('group/' + encodeURIComponent(name) + '/members', {username}, function(error, data){
			callback(error, data);
		});
	}

	function removeMember(name, username, callback){
		app.api.delete('group/' + encodeURIComponent(name) + '/members/' + encodeURIComponent(username), function(error, data){
			callback(error, data);
		});
	}

	return {list, add, remove, addMember, removeMember};

})(app);

app.util = (function(app){

	function getUrlParameter(name){
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
		var results = regex.exec(location.search);
		return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};

	// escapeHtml/actionMessage/actionConfirm moved to @simpleworkjs/frontend's
	// app.util.escapeHtml and app.messages.action/confirm.
	function escapeHtml(s){
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	$.fn.serializeObject = function() {
		var obj = {};

		// Get the form values and work over them
		for (let {name, value} of $(this).serializeArray()) {
			console.log(name, value)
			if (obj[name] === undefined) {
				if (!value
					&& !$(this).parent().find(`[name="${name}"]`).attr('value')
					// Keep empty <textarea>s so a cleared field is submitted (and
					// can reset a list, e.g. the per-host IP/header controls).
					&& !$(this).filter(`textarea[name="${name}"]`).length
				){
					continue;
				}

				obj[name] = value;

				let type = $(this).parent().find(`[name="${name}"]`).attr('type');
				if (['number', 'range'].includes(type)) {
					obj[name] = Number(value);
				}

				if (['radio'].includes(type) && ['true', 'false'].includes(value)) {
					obj[name] = value == 'true' ? true : false;
				}
			} else {
				if (!(obj[name] instanceof Array)) {
					obj[name] = [obj[name]];
				}
				obj[name].push(value);
			}

		}

		return obj;
	};

	function downloadFile(filename, text){
		// https://stackoverflow.com/a/18197341

		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		element.setAttribute('download', filename);

		element.style.display = 'none';
		document.body.appendChild(element);

		element.click();

		document.body.removeChild(element);
	}

	// Scroll a just-added/-edited element into view and flash its
	// background, so the user's eye lands on the row that changed instead of
	// it silently appearing/updating somewhere off-screen. Takes a jQuery
	// object or a raw DOM node (e.g. jq-repeat's `item.__jq_$el`).
	function revealItem(el){
		var node = el && el.jquery ? el[0] : el;
		if (!node) return;
		if (typeof node.scrollIntoView === 'function') {
			node.scrollIntoView({behavior: 'smooth', block: 'center'});
		}
		var prevTransition = node.style.transition;
		var prevBg = node.style.backgroundColor;
		node.style.transition = 'background-color 1.5s ease';
		node.style.backgroundColor = 'var(--bs-success-bg-subtle, #d1e7dd)';
		setTimeout(function(){
			node.style.backgroundColor = prevBg;
			setTimeout(function(){ node.style.transition = prevTransition; }, 1500);
		}, 300);
	}

	return {
		downloadFile: downloadFile,
		getUrlParameter: getUrlParameter,
		escapeHtml: escapeHtml,
		revealItem: revealItem,
	}
})(app);

// Reveal every .group-required-<cn> element the current user's groups entitle
// them to. Elements carrying .group-required start hidden (styles.css), so a
// user who is in no groups — or who isn't logged in — simply never sees them.
app.auth.applyGroupVisibility = function(user){
	var groups = app.auth.groupCNs(user);
	if(!groups.length) return;

	var style = document.getElementById('group-required-rules');
	if(!style){
		style = document.createElement('style');
		style.id = 'group-required-rules';
		document.head.appendChild(style);
	}

	for(var group of groups){
		try{
			style.sheet.insertRule(
				`.group-required-${CSS.escape(group)} { display: revert !important; }`,
				style.sheet.cssRules.length
			);
		}catch(error){
			// A group whose CN isn't a usable CSS identifier just gates nothing.
		}
	}
};

$( document ).ready(async function(){

	// Show content the user's groups entitle them to.
	app.auth.applyGroupVisibility(await app.auth.loadUser());

	$('div.row').fadeIn('slow'); //show the page

	//panel button's
	$('.fa-arrows-v').click(function(){
		$(this).closest('.card').find('.card-body').slideToggle('fast');
	});

	$('.fa-circle-minus').click(function(){
		let $body = $(this).closest('.card').find('.card-body');
		if($body.hasClass('d-none')){
			$body.removeClass("d-none").removeClass('d-md-block');
			if($body.is(":visible")) $body.hide();
		}
		$body.slideToggle('fast');
	});

	$('.fa-circle-xmark').click(function(){
		$(this).closest('.card').slideUp('fast');
	});

	// action-close click handling is wired by @simpleworkjs/frontend's
	// app.messages.js (delegated on document, so it also covers messages
	// rendered after this ready handler runs).

	setInterval(()=>{
		$('.momentFromNow').each((idx, el)=>{
			var $el = $(el);
			try{
				$el.html(moment($(el).data('date')).fromNow());
			}catch{}
		})
	}, 30000,);
});

(function($){
	$.fn.scrollTo = function(){
		const yOffset = Number($('#spa-shell').css('margin-top').replace('px', ''));
		const y = this[0].getBoundingClientRect().top + window.scrollY - yOffset;

		console.log('y', y)
		window.scrollTo({top: y, behavior: 'smooth'});
	};

})(jQuery);

//ajax form submit
function formAJAX(btn){
	event.preventDefault(btn); // avoid to execute the actual submit of the form.
	var $form = $(btn || event.target).closest('[action]'); // gets the 'form' parent
	var formData = $form.find('[name]').serializeObject(); // builds query formDataing
	var method = ($form.attr('method') || 'post').toLowerCase();

	if($form.validate && !$form.validate()){
		app.messages.action('Please fix the form errors.', $form, 'danger')
		return false;
	}

	// Plain text: app.messages.action HTML-escapes its message (by design,
	// see @simpleworkjs/frontend), so raw markup like a spinner <div> would
	// render literally instead of as an element.
	app.messages.action('Saving…', $form, 'info');

	app.api[method]($form.attr('action'), formData, function(error, data){
		app.messages.action(data.message, $form, error ? 'danger' : 'success'); //re-populate table
		$form.validateClear();
		if(!error){
			$form.trigger("reset");
			eval($form.attr('evalAJAX')); //gets JS to run after completion
		}else{
			console.log('formAJAX res error', error, data)
			if(data && data.name === 'ObjectValidateError'){
				app.messages.action('Please fix the form errors', $form, 'danger'); //re-populate table
			}
			if(data && data.keys){
				console.log('form key errors', data.keys)
				for(let keyError of data.keys){
					$form.find(`[name=${keyError.key}]`).validateMessage(keyError.message);
				}
			}
		}
	});
}
