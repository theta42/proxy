'use strict';

const router = require('express').Router();
const {getCert} = require('../models/cert');
const authz = require('../middleware/authz');


router.get('/:host', authz.requireAdmin, async function(req, res, next){
	try{
		let cert = await getCert(req.params.host);
		if (!cert) return res.status(404).json({});
		// Strip the private key and CSR before responding: this endpoint is
		// read-only (cert metadata for the UI) and must never expose secrets,
		// even to admins. The private key never leaves the box.
		delete cert.privkey_pem;
		delete cert.csr_pem;
		return res.json(cert);
	}catch(error){
		return next(error);
	}
});

module.exports = router;
