'use strict';

const Table = require('.');
const ModelPs = require('../utils/model_pubsub');

/**
 * LocalGroup
 *
 * An app-managed group with an explicit member list. Local groups behave exactly
 * like groups carried from SSO/LDAP: their names can be used as a Permission
 * subject (subjectType: 'group'), and in conf.auth.adminGroups / groupRoleMap.
 * Membership is merged into a session's identity by Permission.effectiveFor.
 */
class LocalGroup extends Table{
	static _key = 'name';
	static _keyMap = {
		'name': {isRequired: true, type: 'string', min: 1, max: 100},
		'members': {default: function(){return []}, isRequired: false, type: 'object'},
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
	}

	// Normalize a group name to a slug (lowercase, safe chars) so it round-trips
	// cleanly through URLs and matches consistently against session groups.
	static slug(name){
		return String(name || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
	}

	static async create(data){
		data.name = this.slug(data.name);
		if(!data.name){
			throw this.errors.ObjectValidateError([{key: 'name', message: 'A group name is required.'}]);
		}
		if(!Array.isArray(data.members)) data.members = [];
		return super.create(data);
	}

	async addMember(username){
		username = String(username || '').trim();
		if(!username){
			throw this.constructor.errors.ObjectValidateError([{key: 'username', message: 'A username is required.'}]);
		}
		let members = Array.isArray(this.members) ? this.members : [];
		if(members.includes(username)) return this;
		return this.update({members: [...members, username]});
	}

	async removeMember(username){
		let members = (Array.isArray(this.members) ? this.members : []).filter(m => m !== username);
		return this.update({members});
	}

	// Expose the members as {group, username} objects (so the UI's per-member
	// remove button knows which group it belongs to) plus a count. Flows through
	// both the REST list and websocket payloads.
	toJSON(){
		let base = super.toJSON();
		let members = Array.isArray(base.members) ? base.members : [];
		return {
			...base,
			memberList: members.map(u => ({group: base.name, username: u})),
			memberCount: members.length,
		};
	}
}

LocalGroup.register(ModelPs(LocalGroup));

module.exports = {LocalGroup};
