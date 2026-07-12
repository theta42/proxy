'use strict';

const conf = require('@simpleworkjs/conf');
const {Host} = require('../models/host');
const {DnsProvider} = require('../models').models;


function hostSchedulerService(){
	/**
	* Host Scheduler Service
	*
	* Manages scheduled tasks for host-related operations:
	* - Wildcard SSL certificate renewal checks
	*
	* Schedule:
	* - Initial check: 30 seconds after application starts
	* - Recurring checks: Every 24 hours (86400000ms)
	*
	* The checkWildcardForRenew method:
	* - Iterates through all hosts in the system
	* - Checks if wildcard certificates are expiring within 30 days
	* - Automatically renews certificates that are approaching expiration
	*/

	// Initial wildcard cert check 30 seconds after app starts
	// Delay allows the system to fully initialize before checking certs
	setTimeout(Host.checkWildcardForRenew.bind(Host), conf.service.hostScheduler.initial);

	// Check wildcard certs once every 24 hours
	// Ensures certificates are renewed well before expiration
	setInterval(Host.checkWildcardForRenew.bind(Host), conf.service.hostScheduler.interval);

	// Refresh each DNS provider's domain list on the same cadence so domains
	// added/removed at the provider are picked up without a manual refresh.
	setTimeout(DnsProvider.refreshAllDomains.bind(DnsProvider), conf.service.hostScheduler.initial);
	setInterval(DnsProvider.refreshAllDomains.bind(DnsProvider), conf.service.hostScheduler.interval);

	console.log('Host scheduler service initialized');
	console.log('- Wildcard cert check: 30s after start, then every 24h');
	console.log('- DNS provider domain refresh: 30s after start, then every 24h');
}

if(conf.service.hostScheduler.enabled !== false) hostSchedulerService();


module.exports = {};
