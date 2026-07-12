'use strict';

const Table = require('.');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Self-service personal access token (PAT) for the proxy management API.
// Format:  prx_<id>_<secret>
//   id     — 24-char hex, stored plaintext as the record key (O(1) lookup)
//   secret — 48-char hex, stored only as a bcrypt hash (isPrivate); shown ONCE
//
// Authenticated via `Authorization: Bearer prx_...` (see middleware/auth.js).
// A token authenticates AS its creator: created_by + the groups the creator
// held at mint time are snapshotted onto the record (mirroring how the proxy's
// browser AuthToken captures groups at login — the proxy never re-queries the
// IdP). The authz layer reuses req.user/req.groups unchanged; local groups and
// owned-domain rights are recomputed live by Permission.effectiveFor.
//
// No `static _ttl`: records persist (lifetime is the optional expires_at field).
// Deliberately NOT wrapped in ModelPs — the best-effort last_used_on write on
// the auth path would otherwise spam the socket on every API call.

const PREFIX = 'prx_';
const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

class ApiToken extends Table{
	static _key = 'id';
	static _keyMap = {
		'id':           {default: function(){ return randomHex(12) }, type: 'string'},
		'secret_hash':  {isRequired: true, type: 'string', isPrivate: true},
		'name':         {isRequired: true, type: 'string', min: 1, max: 255},
		'description':  {default: '', type: 'string'},
		'created_by':   {isRequired: true, type: 'string', min: 3, max: 500},
		// Group memberships captured at mint (from the creator's session) — the
		// mint-time snapshot the token authenticates with.
		'groups':       {default: function(){ return [] }, isRequired: false, type: 'object'},
		'created_on':   {default: function(){return (new Date).getTime()}},
		'updated_on':   {default: function(){return (new Date).getTime()}, always: true},
		'expires_at':   {default: 0, type: 'number'}, // epoch ms; 0 = never
		'last_used_on': {default: 0, type: 'number'},
		'is_valid':     {default: true, type: 'boolean'},
	}

	get isExpired() {
		return this.expires_at > 0 && (new Date).getTime() > this.expires_at;
	}

	static async add(data){
		const id = randomHex(12);
		const secret = randomHex(24);
		data.id = id;
		data.secret_hash = await bcrypt.hash(secret, 10);
		if(!Array.isArray(data.groups)) data.groups = [];
		const token = await this.create(data);
		token._raw_token = `${PREFIX}${id}_${secret}`;
		return token;
	}

	async rotate(){
		const secret = randomHex(24);
		await this.update({ secret_hash: await bcrypt.hash(secret, 10) });
		return `${PREFIX}${this.id}_${secret}`;
	}

	// Validate a raw `prx_<id>_<secret>` string. Throws a generic Error on any
	// failure so the caller (Auth.checkApiToken) can collapse every case into
	// one 401 (no existence / wrong-secret / expired leak).
	static async authenticate(raw){
		const m = /^prx_([0-9a-f]{24})_([0-9a-f]{48})$/i.exec(String(raw || ''));
		if(!m) throw new Error('InvalidApiToken');
		let token;
		try{
			token = await this.get(m[1]);
		}catch(e){
			throw new Error('InvalidApiToken');
		}
		if(!token) throw new Error('InvalidApiToken');
		const ok = await bcrypt.compare(m[2], token.secret_hash);
		if(!ok || !token.is_valid || token.isExpired) throw new Error('InvalidApiToken');
		// Best-effort: stamp last use. Fire-and-forget so a Redis hiccup never
		// fails an otherwise-valid request.
		try{ await token.update({ last_used_on: (new Date).getTime() }); }catch(_){}
		return token;
	}
}

ApiToken.register();

module.exports = {ApiToken};