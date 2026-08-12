'use strict';

/**
 * PubSub controller dependency to handle message broadcasting
 */
const ps = require('../controller/pubsub');

/**
 * Wraps a model in a Proxy to automatically publish events on specific method calls.
 * @param {Object|Function} model - The data model or instance to be proxied.
 * @returns {Proxy} - The proxied model.
 */
function ModelPs(model, options) {
	// Which mutations announce themselves. Defaults to all of them; a model
	// with a hot, uninteresting write path can narrow it — see ApiToken, whose
	// best-effort `last_used_on` touch happens on every authenticated API call
	// and would otherwise put an event on the socket for each one.
	const actions = (options && options.actions) || ['add', 'create', 'update', 'remove'];
	// Ensure we have a reference to the class constructor regardless of whether an instance or class was passed
	const Model = model.constructor.name === 'Function' ? model : model.constructor;
	
	/**
	 * Extracts the unique identifier (primary key) from the model or request/response objects.
	 */
	function getIndex(req, res) {
		// `model` is the class itself on a static call, and every class has a
		// built-in `.name` — so for any model whose _key is 'name' this used to
		// return the CLASS name ("LocalGroup") as the primary key of every
		// event. Creates then looked up a key that matched nothing and appended
		// a row; updates did the same, duplicating the record instead of
		// patching it. Host was the only model that behaved, purely because its
		// _key is 'host' and `Host.host` happens to be undefined.
		if (typeof model !== 'function' && model[Model._key] !== undefined) {
			return model[Model._key];
		}
		if (req && req[Model._key] !== undefined) return req[Model._key];
		if (res && res[Model._key] !== undefined) return res[Model._key];
	}

	/**
	 * Formats and broadcasts the message via PubSub.
	 * Topic format: model:ClassName:Action:ID
	 */
	function publish(prop, res, req) {
		try {
			// Only trigger for the mutations this model announces.
			if (!actions.includes(prop)) return;

			ps.publish(`model:${Model.name}:${prop}:${getIndex(res, req)}`, res);
		} catch (error) {
			console.log('ModelPs.publish ERROR', error);
		}
	}

	/**
	 * Standardized error logger that ignores common/non-critical HTTP errors
	 */
	function handleError(error, model, propKey) {
		if (![401, 404, 429].includes(error.status)) {
			console.error("Error PS", model.name, propKey, error);
		}
	}

	return new Proxy(model, {
		/**
		 * Intercepts 'new' keyword calls to ensure instances are also proxied.
		 */
		construct(target, args, newTarget) {
			// Carry the options through: an instance built from a narrowed
			// class must stay narrowed, or the very writes we excluded would
			// announce themselves from the instance instead.
			return ModelPs(Reflect.construct(target, args, newTarget), options);
		},

		/**
		 * Intercepts property/method access.
		 */
		get(target, propKey, receiver) {
			// Ensure constructor access remains direct
			if (propKey == 'constructor') return target.constructor;

			const targetValue = Reflect.get(target, propKey, receiver);

			// If the property accessed is a function, wrap it to inject the PubSub logic
			if (typeof targetValue === 'function') {
				return function(...args) {
					try {
						// Execute the original method
						var res = Reflect.apply(targetValue, this, args);

						// Handle Asynchronous results (Promises)
						if (targetValue.constructor.name === 'AsyncFunction') {
							res.then(function(res) {
								publish(propKey, res, ...args);
							}).catch((error) => handleError(error, model, propKey));

						} else {
							// Handle Synchronous results
							publish(propKey, res, ...args);
						}
						return res;
					} catch (error) {
						handleError(error, model, propKey);
					}
				};
			} else {
				return targetValue;
			}
		}
	});
}

module.exports = ModelPs;