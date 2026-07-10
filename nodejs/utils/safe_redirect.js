'use strict';

/**
 * Constrain a post-login redirect target to a same-origin path.
 *
 * Rejects anything that could leave the site or execute script:
 *   - absolute URLs        ("https://evil.com")            -> not a "/" path
 *   - protocol-relative    ("//evil.com", "/\\evil.com")   -> host takeover
 *   - scheme targets       ("javascript:...", "data:...")  -> XSS
 * Anything not a plain "/path" falls back to "/".
 *
 * The browser has its own copy of this in public/lib/js/app-base.js; keep the
 * two in sync.
 */
function safeInternalPath(path){
	if(typeof path !== 'string' || path.charAt(0) !== '/'
			|| path.charAt(1) === '/' || path.charAt(1) === '\\'){
		return '/';
	}
	return path;
}

module.exports = {safeInternalPath};
