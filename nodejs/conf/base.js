'use strict';
// Using https://github.com/simpleworkjs/conf to handle configuration

module.exports = {
	userModel: 'redis', // pam, redis, ldap
	ldap: {
		url: 'ldap://192.168.1.55:389',
		bindDN: 'cn=ldapclient service,ou=people,dc=theta42,dc=com',
		bindPassword: '__IN SRECREST FILE__',
		searchBase: 'ou=people,dc=theta42,dc=com',
		userFilter: '(objectClass=inetOrgPerson)',
		userNameAttribute: 'uid'
	},
	socketFile: '/var/run/proxy_lookup.socket',
	redis: {
		prefix: 'proxy_'
	},

	// Lifetime, in seconds, of on-demand wildcard-subdomain cache entries
	// (the is_cache Host records created by Host.addCache). They expire on
	// their own via redis TTL so they stop accumulating and stale routes
	// self-correct. 0 disables expiry (entries live until bustCache/clearCache).
	cacheTTL: 3600,

	// OpenID Connect login against the SSO. Endpoints come from the SSO's
	// /.well-known/openid-configuration. clientSecret lives in secrets.js.
	// redirectUri MUST be registered on the SSO client and match exactly.
	oidc: {
		enabled: true,
		issuer: 'https://sso.theta42.com',
		authorizationEndpoint: 'https://sso.theta42.com/oauth/authorize',
		tokenEndpoint: 'https://sso.theta42.com/oauth/token',
		userinfoEndpoint: 'https://sso.theta42.com/oauth/userinfo',
		endSessionEndpoint: 'https://sso.theta42.com/oauth/logout',
		clientId: '__SET_ME__',
		// Where the SSO sends the user back. Must be an absolute URL reachable
		// by the browser and registered on the SSO client.
		redirectUri: 'http://localhost:3000/api/auth/oidc/callback',
		scopes: ['openid', 'profile', 'email', 'groups'],
		// Claim on the userinfo response that carries group membership.
		groupsClaim: 'groups',
		// Claim used as the local username.
		usernameClaim: 'preferred_username',
	},

	// Authorization: how groups map to roles, and which groups are global admin.
	// Per-user overrides are Grant records managed in the app.
	auth: {
		// Members of these SSO/LDAP groups are always global admins.
		adminGroups: [],
		// Optional default role mapping for groups, e.g.
		//   { 'dns-team': { role: 'manager', scope: 'domain', domain: 'foo.com' } }
		//   { 'proxy-viewers': { role: 'viewer', scope: 'global' } }
		groupRoleMap: {},
		// Local users always treated as global admin (anti-lockout bootstrap).
		adminUsers: ['proxyadmin2'],
	},

	service:{
		hostScheduler:{
			enabled: true,
			initial: 30000,
			interval: 86400000,
		},
		dynamicDns:{
			enabled: true,
			initial: 15000,      // first refresh 15s after start
			interval: 14400000,  // then every 4 hours
		}
	},

	// Dynamic DNS: services queried (in order) to learn this box's public IP.
	dynamicDns:{
		ipServices: [
			'https://api.ipify.org',
			'https://icanhazip.com',
			'https://ifconfig.me/ip',
		],
	},

	// Per-host SSO (#57). Reuses conf.oidc for the identity provider. Sessions
	// are Redis-backed and read directly by OpenResty; the cookie only carries a
	// random session id.
	hostSso:{
		enabled: true,
		sessionTtl: 28800,          // 8 hours, in seconds
		cookieName: '__proxy_sso',
	},
};
