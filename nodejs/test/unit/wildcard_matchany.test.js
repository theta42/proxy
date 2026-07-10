'use strict';

const {describe, test, before} = require('node:test');
const assert = require('node:assert');

/**
 * Tests for the wildcard "match only subdomains defined here" behavior.
 *
 * A wildcard host can be created with wildcard_matchAny = false ("Match only
 * subdomains defined here"). In that mode the wildcard cert covers the whole
 * subtree for TLS, but only subdomains that are explicitly defined in redis may
 * actually be proxied — an undefined subdomain must be rejected rather than
 * routed to the wildcard parent.
 *
 * Two pieces of logic combine to produce a routing decision:
 *   1. Host.lookUp(tree, host) — walks the lookup tree and returns the matched
 *      #record (or undefined). See models/host.js.
 *   2. The host_lookup service guard — given the matched record and the
 *      requested domain, decides whether it may actually be served. See
 *      services/host_lookup.js onData().
 *
 * These are exercised here without a redis connection, mirroring the approach
 * in host_lookup.test.js.
 */

describe('Wildcard matchAny routing', () => {

	// --- helpers that mirror the real implementation -----------------------

	// Faithful copy of Host.lookUp from models/host.js (including the `parent`
	// tracking and the final parent['*'] fallback). Kept in sync with that
	// method; the algorithm is pure so it can be unit-tested standalone.
	function lookUp(lookUpObj, host){
		let place = lookUpObj;
		let last_resort = {};
		let parent = undefined;

		for(let fragment of host.split('.').reverse()){
			parent = place;
			if(place['**']) last_resort = place['**'];

			if({...last_resort, ...place}[fragment]){
				place = {...last_resort, ...place}[fragment];
			}else if(place['*']){
				place = place['*'];
			}else if(last_resort){
				place = last_resort;
			}
		}

		if(place && place['#record']) return place['#record'];
		if(parent && parent['*'] && parent['*']['#record']) return parent['*']['#record'];
	}

	// Mirror of the host_lookup service serve decision (services/host_lookup.js
	// onData): a wildcard with matchAny disabled only serves the exact wildcard
	// host itself, never an inexact (undefined) subdomain. Returns the served
	// host name, or null when the request must be rejected.
	function serve(record, domain){
		if(!record) return null;
		if(record.is_wildcard && !record.wildcard_matchAny && record.host !== domain){
			return null;
		}
		return record.host;
	}

	function buildTree(records){
		const tree = {};
		for(const host of Object.keys(records)){
			let fragments = host.split('.');
			let pointer = tree;
			while(fragments.length){
				let fragment = fragments.pop();
				if(!pointer[fragment]) pointer[fragment] = {};
				if(fragments.length === 0) pointer[fragment]['#record'] = records[host];
				pointer = pointer[fragment];
			}
		}
		return tree;
	}

	const resolve = (records, domain) => serve(lookUp(buildTree(records), domain), domain);

	// --- matchAny = false ---------------------------------------------------

	describe('matchAny disabled ("only defined subdomains")', () => {
		const records = {
			'*.example.com': {host: '*.example.com', is_wildcard: true, wildcard_matchAny: false},
			'api.example.com': {host: 'api.example.com', is_wildcard: false},
		};

		test('serves an explicitly defined subdomain', () => {
			assert.strictEqual(resolve(records, 'api.example.com'), 'api.example.com');
		});

		test('rejects an undefined subdomain (does not route to the wildcard)', () => {
			assert.strictEqual(resolve(records, 'nope.example.com'), null);
		});

		test('rejects a deep undefined subdomain', () => {
			assert.strictEqual(resolve(records, 'a.b.example.com'), null);
		});

		test('does not serve the apex when only a wildcard is defined', () => {
			assert.strictEqual(resolve(records, 'example.com'), null);
		});
	});

	// --- matchAny = true ----------------------------------------------------

	describe('matchAny enabled', () => {
		const records = {
			'*.open.example.com': {host: '*.open.example.com', is_wildcard: true, wildcard_matchAny: true},
		};

		test('serves the wildcard for any undefined subdomain', () => {
			assert.strictEqual(resolve(records, 'anything.open.example.com'), '*.open.example.com');
		});
	});

	// --- sibling wildcards with mixed policies ------------------------------

	describe('sibling wildcards with mixed matchAny', () => {
		const records = {
			'*.secure.example.com': {host: '*.secure.example.com', is_wildcard: true, wildcard_matchAny: false},
			'*.open.example.com':   {host: '*.open.example.com',   is_wildcard: true, wildcard_matchAny: true},
		};

		test('the matchAny=false branch rejects undefined subdomains', () => {
			assert.strictEqual(resolve(records, 'x.secure.example.com'), null);
		});

		test('the matchAny=true branch serves undefined subdomains', () => {
			assert.strictEqual(resolve(records, 'x.open.example.com'), '*.open.example.com');
		});
	});

	// --- cache-entry characterization --------------------------------------

	describe('cached subdomain entries', () => {
		// addCache() stores an on-demand subdomain as its own Host with
		// is_wildcard flattened to false, so the matchAny guard (which keys off
		// is_wildcard) does not apply to it — a cache entry is served directly.
		// This is why such entries are given a TTL (conf.cacheTTL) and are busted
		// on parent update: correctness under matchAny=false relies on stale
		// cache entries expiring / being cleared, not on a serve-time guard.
		const records = {
			'*.example.com':     {host: '*.example.com',     is_wildcard: true,  wildcard_matchAny: false},
			'cached.example.com': {host: 'cached.example.com', is_wildcard: false, is_cache: true},
		};

		test('a live cache entry is served directly (regardless of parent matchAny)', () => {
			assert.strictEqual(resolve(records, 'cached.example.com'), 'cached.example.com');
		});

		test('once the cache entry is gone, the undefined subdomain is rejected', () => {
			const expired = {
				'*.example.com': {host: '*.example.com', is_wildcard: true, wildcard_matchAny: false},
			};
			assert.strictEqual(resolve(expired, 'cached.example.com'), null);
		});
	});
});
