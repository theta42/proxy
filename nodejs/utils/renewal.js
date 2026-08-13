'use strict';

/**
 * When to renew a certificate.
 *
 * This used to be a hardcoded "within 30 days of expiry", checked daily. That
 * is a third of a 90-day certificate's life, which was a reasonable buffer for
 * as long as 90 days was the only lifetime anyone issued. It is not any more:
 * Let's Encrypt now issues 6-day certificates, and the CA/B Forum has voted
 * maximum validity down in steps toward roughly 47 days. Against a 47-day cert
 * the constant renews at two weeks old and the buffer stops meaning anything;
 * against a 6-day cert it is true on every check, so the renewal loop reissues
 * daily forever and walks into rate limits.
 *
 * So the threshold is a FRACTION of the certificate's own lifetime rather than
 * an absolute duration. Both endpoints come off the certificate itself
 * (notBefore/notAfter), so this stays correct at any validity period without
 * anyone remembering to retune it.
 *
 * The real answer is ARI (ACME Renewal Info): the CA publishes a suggested
 * renewal window per certificate, which removes the guess entirely and lets it
 * pull renewals forward during a mass revocation. See issue #230 / #229 — until
 * the ACME client underneath supports it, this is the closest safe thing.
 */

// Renew once two thirds of the lifetime has elapsed. Leaves a third of the
// validity period to retry in, which at 90 days is 30 (matching the old
// behaviour exactly) and at 47 days is ~15 — still many daily attempts, and
// still far more than the ~10-day domain-validation reuse window that wildcard
// renewals will have to re-clear.
const RENEW_AFTER_FRACTION = 2 / 3;

// Used only when the issue date is unknown and cannot be recovered from the
// stored certificate. Deliberately expressed as a lifetime guess rather than a
// renewal offset, so the fraction above stays the single rule.
const ASSUMED_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

function toTime(value) {
	if (value === undefined || value === null || value === '') return NaN;
	const time = value instanceof Date ? value.getTime() : Number(value);
	return Number.isFinite(time) ? time : NaN;
}

/**
 * The moment renewal should begin, in epoch ms.
 *
 * `issued` may be absent on records written before it was stored; the caller
 * should recover it from the certificate when it can (models/host.js does), and
 * this falls back to assuming a 90-day lifetime only when it cannot. That
 * fallback is wrong for a short-lived certificate, but wrong in the safe
 * direction: it renews later than ideal rather than on every check.
 */
function renewalPoint(issued, expires) {
	const expiresAt = toTime(expires);
	if (!Number.isFinite(expiresAt)) return NaN;

	let issuedAt = toTime(issued);
	if (!Number.isFinite(issuedAt) || issuedAt >= expiresAt) {
		issuedAt = expiresAt - ASSUMED_LIFETIME_MS;
	}

	return issuedAt + (expiresAt - issuedAt) * RENEW_AFTER_FRACTION;
}

/**
 * Whether a certificate is due for renewal. An already-expired certificate is
 * always due — there is nothing left to protect by waiting.
 */
function shouldRenew(issued, expires, now) {
	const at = renewalPoint(issued, expires);
	if (!Number.isFinite(at)) return false;
	return (now === undefined ? Date.now() : now) >= at;
}

module.exports = {shouldRenew, renewalPoint, RENEW_AFTER_FRACTION, ASSUMED_LIFETIME_MS};
