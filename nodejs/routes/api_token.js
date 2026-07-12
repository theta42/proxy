'use strict';

// Self-service API token (PAT) management. Every endpoint is owner-scoped: a
// user only sees / mutates tokens where created_by === reqUsername(req). No
// authz.requireAdmin gate (self-service); the Bearer-authed requests these
// tokens enable carry the creator's own effective rights via the authz layer.

const router = require('express').Router();
const {ApiToken} = require('../models/api_token');
const {reqUsername} = require('../middleware/authz');

function forbidden(){
	let error = new Error('Forbidden');
	error.name = 'Forbidden';
	error.message = 'You do not own this API token.';
	error.status = 403;
	return error;
}

// Resolve a token the caller owns. Missing or not-yours both raise 403 (no
// existence leak; ids are unguessable random hex anyway).
async function getOwned(req, id){
	let token;
	try{
		token = await ApiToken.get(id);
	}catch(e){
		throw forbidden();
	}
	const me = reqUsername(req);
	if(!token || token.created_by !== me) throw forbidden();
	return token;
}

router.get('/', async function(req, res, next){
	try{
		return res.json({results: await ApiToken.listDetail({created_by: reqUsername(req)})});
	}catch(error){
		next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		const days = req.body.expires_in_days !== '' && req.body.expires_in_days !== undefined
			? Number(req.body.expires_in_days) : 0;

		const token = await ApiToken.add({
			name: req.body.name,
			description: req.body.description || '',
			created_by: reqUsername(req),
			// Snapshot the creator's current groups (mint-time, like AuthToken).
			groups: req.groups || [],
			expires_at: days > 0 ? (new Date).getTime() + days * 86400000 : 0,
		});

		return res.json({
			results: token,
			token: token._raw_token,
			message: `API token '${token.name}' created. Save it now — it will not be shown again.`,
		});
	}catch(error){
		next(error);
	}
});

router.get('/:id', async function(req, res, next){
	try{
		return res.json({results: await getOwned(req, req.params.id)});
	}catch(error){
		next(error);
	}
});

router.put('/:id', async function(req, res, next){
	try{
		const token = await getOwned(req, req.params.id);

		const update = {};
		for(const k of ['name', 'description']){
			if(req.body[k] !== undefined) update[k] = req.body[k];
		}
		if(req.body.expires_in_days !== undefined && req.body.expires_in_days !== ''){
			const days = Number(req.body.expires_in_days);
			update.expires_at = days > 0 ? (new Date).getTime() + days * 86400000 : 0;
		}else if(req.body.expires_at !== undefined){
			update.expires_at = Number(req.body.expires_at) || 0;
		}

		return res.json({
			results: await token.update(update),
			message: `API token '${token.name}' updated.`,
		});
	}catch(error){
		next(error);
	}
});

router.delete('/:id', async function(req, res, next){
	try{
		const token = await getOwned(req, req.params.id);
		await token.remove();
		return res.json({id: req.params.id, message: `API token '${token.name}' revoked.`});
	}catch(error){
		next(error);
	}
});

router.post('/:id/rotate', async function(req, res, next){
	try{
		const token = await getOwned(req, req.params.id);
		const raw = await token.rotate();
		return res.json({
			token: raw,
			message: `API token '${token.name}' rotated. Save it — it will not be shown again.`,
		});
	}catch(error){
		next(error);
	}
});

module.exports = router;