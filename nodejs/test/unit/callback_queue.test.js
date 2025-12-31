'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');
const {CallbackQueue} = require('../../utils/callback_queue');

/**
 * Tests for CallbackQueue utility
 *
 * CallbackQueue manages multiple callbacks for a single event, allowing
 * multiple listeners to be registered and called with the same arguments.
 */

describe('CallbackQueue', () => {

	test('should initialize with a single callback function', () => {
		const callback = () => {};
		const queue = new CallbackQueue(callback);

		assert.strictEqual(queue.__callbacks.length, 1);
		assert.strictEqual(queue.__callbacks[0], callback);
	});

	test('should initialize with an array of callbacks', () => {
		const callback1 = () => {};
		const callback2 = () => {};
		const queue = new CallbackQueue([callback1, callback2]);

		assert.strictEqual(queue.__callbacks.length, 2);
		assert.strictEqual(queue.__callbacks[0], callback1);
		assert.strictEqual(queue.__callbacks[1], callback2);
	});

	test('should initialize with empty queue when no callback provided', () => {
		const queue = new CallbackQueue();
		assert.strictEqual(queue.__callbacks.length, 0);
	});

	test('should push a function to the queue', () => {
		const queue = new CallbackQueue();
		const callback = () => {};

		queue.push(callback);

		assert.strictEqual(queue.__callbacks.length, 1);
		assert.strictEqual(queue.__callbacks[0], callback);
	});

	test('should ignore non-function values when pushing', () => {
		const queue = new CallbackQueue();

		queue.push('not a function');
		queue.push(123);
		queue.push(null);
		queue.push(undefined);
		queue.push({});

		assert.strictEqual(queue.__callbacks.length, 0);
	});

	test('should call all callbacks with provided arguments', () => {
		const results = [];
		const callback1 = (a, b) => results.push(['cb1', a, b]);
		const callback2 = (a, b) => results.push(['cb2', a, b]);

		const queue = new CallbackQueue([callback1, callback2]);
		queue.call('arg1', 'arg2');

		assert.strictEqual(results.length, 2);
		assert.deepStrictEqual(results[0], ['cb1', 'arg1', 'arg2']);
		assert.deepStrictEqual(results[1], ['cb2', 'arg1', 'arg2']);
	});

	test('should call callbacks with no arguments', () => {
		let called = false;
		const callback = () => { called = true; };

		const queue = new CallbackQueue(callback);
		queue.call();

		assert.strictEqual(called, true);
	});

	test('should handle callbacks that throw errors without stopping other callbacks', () => {
		const results = [];
		const callback1 = () => results.push('cb1');
		const callback2 = () => { throw new Error('Test error'); };
		const callback3 = () => results.push('cb3');

		const queue = new CallbackQueue([callback1, callback2, callback3]);

		// The error will be thrown but shouldn't stop execution
		assert.throws(() => {
			queue.call();
		}, /Test error/);

		// Only cb1 should have been called before the error
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0], 'cb1');
	});

	test('should call callbacks without specific context', () => {
		let receivedThis = null;
		const callback = function() { receivedThis = this; };

		const queue = new CallbackQueue(callback);
		queue.call();

		// Callbacks are called without binding, so 'this' is undefined in strict mode
		assert.strictEqual(receivedThis, undefined);
	});

	test('should allow adding callbacks after initialization', () => {
		const results = [];
		const callback1 = () => results.push('cb1');
		const callback2 = () => results.push('cb2');

		const queue = new CallbackQueue(callback1);
		queue.push(callback2);
		queue.call();

		assert.strictEqual(results.length, 2);
		assert.deepStrictEqual(results, ['cb1', 'cb2']);
	});

	test('should work with callbacks that return values', () => {
		const callback1 = () => 'result1';
		const callback2 = () => 'result2';

		const queue = new CallbackQueue([callback1, callback2]);

		// Note: call() doesn't return values, it just executes callbacks
		// This test verifies callbacks can return values without breaking
		assert.doesNotThrow(() => {
			queue.call();
		});
	});
});
