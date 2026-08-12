'use strict';
const conf = require('@simpleworkjs/conf');
const {setUpTable} = require('model-redis');
const {createOidcClient, bootstrapLocalAdmin} = require('@simpleworkjs/oidc-client');

const Table = setUpTable(conf.redis);

module.exports = Table;

// App-local models. User + ApiToken register before the OIDC client factory
// below: Auth binds User, and checkApiToken wraps ApiToken.authenticate.
require('./user');                      // User (redis-backed local + OIDC JIT)
const {ApiToken} = require('./api_token'); // ApiToken (Bearer PATs)
require('./dns_provider');
require('./dynamic_record');
require('./host');
require('./local_group');
require('./permission');
require('./sso_session');
require('./activity_event');            // notification history (shape only, TTL-bounded)
require('./activity_seen');             // per-user read watermark

// Shared OIDC client (authorization-code + PKCE): session models (Token,
// AuthToken, OidcState), the Auth service, and the /login /logout /oidc/start
// /oidc/callback router — all created on this app's Table/redis. PAT validation
// is wired in (proxy accepts Bearer prx_<id>_<secret>); the package collapses
// every checkApiToken failure to a generic 401.
const oidcClient = createOidcClient({
	Table,
	checkApiToken: (raw) => ApiToken.authenticate(raw),
});
module.exports.Token = oidcClient.Token;
module.exports.AuthToken = oidcClient.AuthToken;
module.exports.OidcState = oidcClient.OidcState;
module.exports.Auth = oidcClient.Auth;
module.exports.authRouter = oidcClient.router;

// Idempotent anti-lockout local admin (was the IIFE in user_redis.js).
bootstrapLocalAdmin(Table.models.User, {defaultName: 'proxyadmin2'});