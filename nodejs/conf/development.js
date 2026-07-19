'use strict';
// Using https://github.com/simpleworkjs/conf to handle configuration

module.exports = {
	userModel: 'redis', // pam, redis, ldap
	ldap: {
		url: 'ldap://localhost',
		bindDN: 'cn=ldapclient service,ou=people,dc=example,dc=com',
		bindPassword: '__IN SRECREST FILE__',
		searchBase: 'ou=people,dc=example,dc=com',
		userFilter: '(objectClass=inetOrgPerson)',
		userNameAttribute: 'uid'
	},
	socketFile: '/var/run/proxy_lookup.socket',
	redis: {
		prefix: 'proxy_'
	},
	service:{
		hostScheduler:{
			enabled: true,
			initial: 5000,
			interval: 86400000,
		},
		dynamicDns:{
			enabled: true,
			initial: 8000,
			interval: 14400000,
		}
	},
};
