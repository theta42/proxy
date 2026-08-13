'use strict';

const {test} = require('node:test');
const assert = require('node:assert');

const {shouldRenew, renewalPoint, ASSUMED_LIFETIME_MS} = require('../../utils/renewal');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 13);

// A certificate issued `age` ago with the given total lifetime.
function cert(lifetimeDays, ageDays) {
	const issued = NOW - ageDays * DAY;
	return {issued, expires: issued + lifetimeDays * DAY};
}

test('a 90-day certificate renews at 30 days out, exactly as before', function () {
	// The behaviour this replaces was "within 30 days of expiry". At 90 days the
	// fraction reproduces it, so nothing changes for certificates issued today.
	const {issued, expires} = cert(90, 0);
	assert.strictEqual(expires - renewalPoint(issued, expires), 30 * DAY);
});

test('a 47-day certificate renews on its own schedule, not at 30 days out', function () {
	// The constant would have renewed this at two weeks old, leaving a buffer
	// that is most of the certificate's life.
	const {issued, expires} = cert(47, 0);
	const remaining = expires - renewalPoint(issued, expires);
	assert.ok(remaining > 15 * DAY && remaining < 16 * DAY, `${remaining / DAY} days`);
});

test('a 6-day certificate is not due the moment it is issued', function () {
	// The whole failure this fixes: "within 30 days of expiry" is true for the
	// entire life of a 6-day certificate, so the daily check reissues every day
	// forever and hits the duplicate-certificate rate limit.
	const fresh = cert(6, 0);
	assert.strictEqual(shouldRenew(fresh.issued, fresh.expires, NOW), false);

	const old = cert(6, 5);
	assert.strictEqual(shouldRenew(old.issued, old.expires, NOW), true);
});

test('renewal leaves a third of the lifetime to retry in, at every lifetime', function () {
	for (const days of [6, 10, 47, 90, 398]) {
		const {issued, expires} = cert(days, 0);
		const window = expires - renewalPoint(issued, expires);
		assert.ok(
			Math.abs(window - (days * DAY) / 3) < 1000,
			`${days}-day cert left ${window / DAY} days, expected ${days / 3}`
		);
	}
});

test('an expired certificate is always due', function () {
	const {issued, expires} = cert(90, 120);
	assert.strictEqual(shouldRenew(issued, expires, NOW), true);
});

test('an unknown issue date assumes 90 days rather than renewing constantly', function () {
	// Records written before wildcard_issued existed. Wrong for a short-lived
	// certificate, but wrong in the safe direction: late, not every check.
	const expires = NOW + 40 * DAY;
	assert.strictEqual(shouldRenew(undefined, expires, NOW), false);
	assert.strictEqual(renewalPoint(undefined, expires), expires - ASSUMED_LIFETIME_MS / 3);

	assert.strictEqual(shouldRenew(null, NOW + 10 * DAY, NOW), true);
});

test('a nonsensical issue date is treated as unknown, not as a lifetime', function () {
	// An issue date at or after expiry would make the lifetime zero or negative,
	// and every certificate permanently due.
	const expires = NOW + 40 * DAY;
	assert.strictEqual(shouldRenew(expires + DAY, expires, NOW), false);
	assert.strictEqual(shouldRenew('not a date', expires, NOW), false);
});

test('a missing expiry never triggers a renewal', function () {
	// A host with no certificate at all must not be dragged into the ACME path
	// on every scheduler tick.
	for (const missing of [undefined, null, '', 'nope', NaN]) {
		assert.strictEqual(shouldRenew(NOW - DAY, missing, NOW), false, String(missing));
	}
});

test('Date objects and epoch numbers are accepted interchangeably', function () {
	// wildcard_issued is stored as a number, but comes off the certificate as a
	// Date; both reach this function depending on the path.
	const {issued, expires} = cert(90, 70);
	assert.strictEqual(
		shouldRenew(new Date(issued), new Date(expires), NOW),
		shouldRenew(issued, expires, NOW)
	);
	assert.strictEqual(shouldRenew(new Date(issued), new Date(expires), NOW), true);
});
