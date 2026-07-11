'use strict';

/**
 * Validation for the user-supplied host / target fields on a Host entry.
 *
 * Neither field may carry a scheme (http://), a path ("/"), a port or ":" of any
 * kind, or whitespace.
 *
 *   host (incoming)  — an IPv4 address or a hostname pattern whose dot-separated
 *                      labels may be normal DNS labels or wildcard fragments:
 *                        "*"  matches exactly one subdomain fragment
 *                        "**" matches any number of fragments
 *                      e.g. "*.example.com", "**.mysite.com", "payments.**", and
 *                      a bare "**" as a global catch-all. (Matched by
 *                      Host.lookUp in models/host.js.)
 *   ip (target)      — a concrete destination: an IPv4 address or a strict
 *                      hostname (dotted, alphabetic TLD). No wildcards.
 *
 * Pure (no I/O) so it can be unit tested and reused. Enforced at the route layer
 * (routes/host.js) so internally-created entries (wildcard children, on-demand
 * cache) are unaffected.
 */

// A single DNS label.
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
// A strict hostname: dotted labels + alphabetic TLD (for the target).
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
// Scheme, path, port, or whitespace — anything that means it isn't a bare host.
const FORBIDDEN = /[\s/:]/;

function isValidIPv4(value){
	if(typeof value !== 'string') return false;
	let parts = value.split('.');
	if(parts.length !== 4) return false;
	// Each octet 0-255, no leading zeros (0 itself is fine).
	return parts.every(p => /^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
}

// A strict, concrete hostname (used for the downstream target). No wildcards.
function isValidHostname(value){
	return typeof value === 'string' && HOSTNAME.test(value);
}

// An incoming-host pattern: dot-separated labels, each a normal label or a
// wildcard fragment ("*" / "**"). A bare "**" is the global catch-all.
function isValidHostPattern(value){
	if(typeof value !== 'string' || value.length === 0 || value.length > 253) return false;
	return value.split('.').every(l => l === '*' || l === '**' || LABEL.test(l));
}

// The incoming `host` field: IPv4 or a wildcard host pattern, no forbidden chars.
function isValidHostField(value){
	if(typeof value !== 'string' || value.length === 0) return false;
	if(FORBIDDEN.test(value)) return false;
	return isValidIPv4(value) || isValidHostPattern(value);
}

// The `ip` (target) field: IPv4 or a strict hostname, no forbidden chars.
function isValidTargetField(value){
	if(typeof value !== 'string' || value.length === 0) return false;
	if(FORBIDDEN.test(value)) return false;
	return isValidIPv4(value) || isValidHostname(value);
}

const NO_CHARS = 'no protocol, "/", or ":".';

/**
 * Collect {key, message} errors for whichever of host / ip are present on the
 * body. Absent fields are skipped (presence/length is handled by the model), so
 * this works for both create (both present) and partial update.
 */
function collectHostFieldErrors(body){
	let errors = [];
	body = body || {};

	if(body.host !== undefined && body.host !== null && body.host !== ''){
		if(!isValidHostField(body.host)){
			errors.push({key: 'host', message: `Host must be a hostname, IP, or wildcard pattern (*, **) — ${NO_CHARS}`});
		}
	}
	if(body.ip !== undefined && body.ip !== null && body.ip !== ''){
		if(!isValidTargetField(body.ip)){
			errors.push({key: 'ip', message: `Target must be a valid hostname or IP address — ${NO_CHARS}`});
		}
	}
	return errors;
}

module.exports = {
	isValidIPv4,
	isValidHostname,
	isValidHostPattern,
	isValidHostField,
	isValidTargetField,
	collectHostFieldErrors,
};
