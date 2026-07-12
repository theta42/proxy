'use strict';

/**
 * Local-account password policy.
 *
 * The previous rule was a single opaque regex that rejected strong passwords
 * (e.g. "@123Caplowercase") while accepting weak ones (e.g. "lowercase1") — see
 * issue #48. This replaces it with a clear, length-forward policy:
 *
 *   - at least MIN characters, and
 *   - either PASSPHRASE+ characters (a long passphrase passes on length alone),
 *     or at least 3 of the 4 character classes (lowercase, uppercase, number,
 *     symbol).
 *
 * Pure and dependency-free so it can run server-side (routes/user.js) and be
 * mirrored client-side (public/lib/js/val.js) and unit tested.
 */

const MIN = 8;
const PASSPHRASE = 12;

// Returns a human-readable error message if the password is unacceptable, else
// null when it passes.
function passwordError(value){
	if(typeof value !== 'string' || value.length < MIN){
		return `Password must be at least ${MIN} characters.`;
	}
	if(value.length >= PASSPHRASE) return null;

	let classes = 0;
	if(/[a-z]/.test(value)) classes++;
	if(/[A-Z]/.test(value)) classes++;
	if(/[0-9]/.test(value)) classes++;
	if(/[^A-Za-z0-9]/.test(value)) classes++;

	if(classes < 3){
		return 'Use at least 3 of: lowercase, uppercase, number, symbol — or make it 12+ characters.';
	}
	return null;
}

module.exports = {passwordError, MIN, PASSPHRASE};
