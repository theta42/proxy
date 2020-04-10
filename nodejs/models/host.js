'use strict';

const Host = require('../utils/redis_model')({
	_name: 'host',
	_key: 'host',
	_keyMap: {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'ip': {isRequired: true, type: 'string', min: 3, max: 500},
		'targetport': {isRequired: true, type: 'number', min:0, max:65535},
		'forcessl': {isRequired: false, default: true, type: 'boolean'},
		'targetssl': {isRequired: false, default: false, type: 'boolean'},
	}
});

module.exports = {Host};
