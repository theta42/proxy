'use strict';

const conf = require('@simpleworkjs/conf');
const {DynamicRecord} = require('../models').models;

function dynamicDnsService(){
	/**
	 * Dynamic DNS Service
	 *
	 * Keeps every declared DynamicRecord pointed at this deployment's current
	 * public (WAN) IP — for sites on WAN DHCP where the IP changes.
	 *
	 * Schedule (conf.service.dynamicDns):
	 * - Initial refresh shortly after start
	 * - Recurring refresh every 4 hours (14400000ms)
	 *
	 * refreshAll resolves the public IP once, then reconciles each record's A
	 * record via the domain's provider (create/replace only when it drifted).
	 */
	setTimeout(DynamicRecord.refreshAll.bind(DynamicRecord), conf.service.dynamicDns.initial);
	setInterval(DynamicRecord.refreshAll.bind(DynamicRecord), conf.service.dynamicDns.interval);

	console.log('Dynamic DNS service initialized');
	console.log(`- Public IP refresh: ${conf.service.dynamicDns.initial / 1000}s after start, then every ${conf.service.dynamicDns.interval / 3600000}h`);
}

if(conf.service.dynamicDns && conf.service.dynamicDns.enabled !== false) dynamicDnsService();

module.exports = {};
