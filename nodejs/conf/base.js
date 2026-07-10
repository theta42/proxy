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

	service:{
		hostScheduler:{
			enabled: true,
			initial: 30000,
			interval: 86400000,
		}
	},
};
