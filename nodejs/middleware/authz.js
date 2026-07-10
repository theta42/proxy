'use strict';

const {Grant} = require('../models/grant');
const tldExtract = require('tld-extract').parse_host;

/**
 * Authorization middleware.
 *
 * Builds on middleware/auth.js (which sets req.user + req.groups). Effective
 * rights are resolved once per request via Grant.effectiveFor and cached on
 * req._effective. Roles: admin > manager (owner/full over a domain) > viewer.
 */

// The username for the request, tolerating a missing user relation by falling
// back to the token's created_by (which is the username).
function reqUsername(req){
	return (req.user && req.user.username) || (req.token && req.token.created_by) || null;
}

// Normalize a host or domain string to its registrable domain.
function toDomain(value){
	if(!value) return value;
	try{
		return tldExtract(value).domain;
	}catch(error){
		return value;
	}
}

// Resolve (and cache) the effective rights for this request.
async function getEffective(req){
	if(req._effective) return req._effective;
	req._effective = await Grant.effectiveFor({
		username: reqUsername(req),
		groups: req.groups || [],
	});
	return req._effective;
}

function forbidden(message){
	let error = new Error('Forbidden');
	error.name = 'Forbidden';
	error.message = message || 'You do not have permission to perform this action.';
	error.status = 403;
	return error;
}

// Global-admin-only gate (user management, DNS providers, grant management).
async function requireAdmin(req, res, next){
	try{
		let effective = await getEffective(req);
		if(effective.isAdmin) return next();
		return next(forbidden('Administrator access required.'));
	}catch(error){
		return next(error);
	}
}

/**
 * Require at least `minRole` on the domain resolved from the request.
 *
 * @param {string} minRole - 'viewer' | 'manager'
 * @param {Function} resolveDomain - (req) => host|domain string
 */
function requireDomainRole(minRole, resolveDomain){
	return async function(req, res, next){
		try{
			let effective = await getEffective(req);
			let domain = toDomain(resolveDomain(req));
			if(!domain) return next(forbidden('Could not determine the target domain.'));

			if(Grant.allows(effective, minRole, domain)) return next();
			return next(forbidden(`You need '${minRole}' rights on ${domain}.`));
		}catch(error){
			return next(error);
		}
	};
}

// Common domain resolvers for route wiring.
const resolve = {
	// A host lives in req.params.item (e.g. api.example.com -> example.com).
	hostParam: req => req.params.item,
	// A host being created lives in the request body.
	hostBody: req => req.body && req.body.host,
	// A domain (or provider domain) name in req.params.item.
	domainParam: req => req.params.item,
};

/**
 * Filter a list of records to those the request may at least view.
 * Admins and holders of a global role see everything; otherwise a record is
 * kept when its domain (via `getDomain`) is one the user has rights on.
 *
 * @param {Object} req
 * @param {Array} records
 * @param {Function} getDomain - (record) => host|domain string
 */
async function filterViewable(req, records, getDomain){
	let effective = await getEffective(req);
	if(effective.isAdmin || Grant.rank(effective.global) >= Grant.rank('viewer')){
		return records;
	}
	return records.filter(function(record){
		let domain = toDomain(getDomain(record));
		return Grant.allows(effective, 'viewer', domain);
	});
}

module.exports = {
	getEffective,
	requireAdmin,
	requireDomainRole,
	filterViewable,
	resolve,
	toDomain,
	reqUsername,
};
