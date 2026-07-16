'use strict';

// Periodic "is a newer release available" check against GitHub releases.
// Nothing auto-updates -- this only surfaces a notice (an admin-only banner,
// see routes/update_check.js + views/top.ejs) so operators know to
// `git pull` + rebuild on their own schedule. State lives in memory only
// (single-process app); a restart just re-checks on the next interval.

const { buildVersion } = require('./build_info');

const REPO = 'theta42/proxy';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

let state = {
	currentVersion: buildVersion,
	latestVersion: null,
	updateAvailable: false,
	releaseUrl: null,
	checkedAt: null,
	error: null,
};

// Basic semver compare (major.minor.patch, ignoring any -prerelease/+build
// suffix) -- good enough for comparing release tags like "v1.2.0" against
// package.json's "1.1.0". Returns true if `a` is strictly newer than `b`.
function isNewer(a, b) {
	const pa = a.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
	const pb = b.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = pa[i] || 0, nb = pb[i] || 0;
		if (na !== nb) return na > nb;
	}
	return false;
}

async function checkNow() {
	try {
		const res = await fetch(API_URL, {
			headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'theta42-proxy-update-check' },
		});
		if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
		const data = await res.json();
		const latestVersion = String(data.tag_name || '').replace(/^v/i, '');

		state = {
			currentVersion: buildVersion,
			latestVersion: latestVersion || null,
			updateAvailable: latestVersion ? isNewer(latestVersion, buildVersion) : false,
			releaseUrl: data.html_url || `https://github.com/${REPO}/releases/latest`,
			checkedAt: Date.now(),
			error: null,
		};
	} catch (error) {
		// Network hiccup, rate limit, no releases published yet, etc. -- keep
		// the previous state and just note the failure; never throw, this
		// runs unattended on a timer.
		state = { ...state, checkedAt: Date.now(), error: error.message };
	}
	return state;
}

function getState() {
	return state;
}

module.exports = { checkNow, getState, isNewer, REPO };
