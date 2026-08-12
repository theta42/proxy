'use strict';

const Table = require('.');

/**
 * How far a user has read their notification feed.
 *
 * One row per user, not one per notification. The unread count is "events since
 * this timestamp that pass your read gate", which makes marking-as-read a
 * single write and makes the count clear on every device at once for free.
 *
 * Not in socket_pubsub's READERS: reading your own notifications is not itself
 * an event anyone needs to hear about.
 */
class ActivitySeen extends Table {
	static _key = 'uid';
	static _keyMap = {
		uid:     {isRequired: true, type: 'string'},
		seen_at: {default: 0,       type: 'number'},
	};
}

ActivitySeen.register();

ActivitySeen.set = async function(uid, seen_at){
	try{
		const row = await ActivitySeen.get(uid);
		return await row.update({seen_at});
	}catch(error){
		return await ActivitySeen.create({uid, seen_at});
	}
};

module.exports = {ActivitySeen};
