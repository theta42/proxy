'use strict';

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
	}
};
