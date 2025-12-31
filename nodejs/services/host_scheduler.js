'use strict';

const {Host} = require('../models/host');

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
setTimeout(Host.checkWildcardForRenew, 30000);

// Check wildcard certs once every 24 hours
// Ensures certificates are renewed well before expiration
setInterval(Host.checkWildcardForRenew, 86400000);

console.log('Host scheduler service initialized');
console.log('- Wildcard cert check: 30s after start, then every 24h');

module.exports = {};
