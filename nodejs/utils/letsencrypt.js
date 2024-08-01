'use strict';

const fs = require('fs')
const axios = require('axios');
const AcmeClient = require('acme-client');
const sleep = require('./sleep');

// https://dns.google/resolve?name=${name}&type=TXT

class LetsEncrypt{
	static AcmeClient = AcmeClient;

	constructor(options){
		this.loadAccountKey(options.accountKeyPath || '~/le_key', (key)=>{
			this.client = new AcmeClient.Client({
				directoryUrl: options.directoryUrl || AcmeClient.directory.letsencrypt.production,
				accountKey: key,
			});
		});
	}

	loadAccountKey(accountKeyPath, cb){
		try{
			// Load the account key if it exists
			cb(fs.readFileSync(accountKeyPath, 'utf8'));
		}catch(error){
			if(error.code === 'ENOENT'){
				// Generate a new account key if it doesn't exist
				AcmeClient.crypto.createPrivateKey().then(function(accountKey){
					fs.writeFileSync(accountKeyPath, accountKey.toString(), 'utf8');
					cb(accountKey.toString());
				});
			}else{
				throw error;
			}
		}
	}

	async dnsWildcard(domain, options){
		/*
		https://github.com/publishlab/node-acme-client/tree/master/examples/dns-01
		*/

		try{
			domain = domain.replace(/^\*\./, '');
			const [key, csr] = await AcmeClient.crypto.createCsr({
				altNames: [domain, `*.${domain}`],
			});

			const cert = await this.client.auto({
				csr,
				email: 'wmantly@gmail.com',
				termsOfServiceAgreed: true,
				challengePriority: ['dns-01'],
				challengeCreateFn: async (authz, challenge, keyAuthorization) => {
					// console.log(`start TXT record key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}`)

					let resCheck = await axios.get(`https://dns.google/resolve?name=_acme-challenge.${authz.identifier.value}&type=TXT`);
					if(resCheck.data.Answer.some(record => record.data === keyAuthorization)) return;

					await options.challengeCreateFn(authz, challenge, keyAuthorization);

					let checkCount = 0;
					while(true){
						await sleep(1500);
						let res = await axios.get(`https://dns.google/resolve?name=_acme-challenge.${authz.identifier.value}&type=TXT`);
						if(res.data.Answer.some(record => record.data === keyAuthorization)){
							// console.log(`found record for key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}`)
							break;
						}
						if(checkCount++ > 60) throw new Error('challengeCreateFn validation timed out');
					}
				},
				challengeRemoveFn: options.challengeRemoveFn,
			});

			return {
				key,
				csr,
				cert,
			};

		}catch(error){
			console.log('Error in LetsEncrypt.dnsChallenge', error)
		}
	}
}

module.exports = LetsEncrypt;

if(require.main === module){(async function(){try{

	const tldExtract = require('tld-extract').parse_host;
	const PorkBun = require('./porkbun');
	const conf = require('../conf/conf');

	let porkBun = new PorkBun(conf.porkBun.apiKey, conf.porkBun.secretApiKey);
	let letsEncrypt = new LetsEncrypt({
		directoryUrl: AcmeClient.directory.letsencrypt.staging,
	});

	let cert = await letsEncrypt.dnsWildcard('dev.test.holycore.quest', {
		challengeCreateFn: async (authz, challenge, keyAuthorization) => {
			let parts = tldExtract(authz.identifier.value);
			let res = await porkBun.createRecordForce(parts.domain, {type:'TXT', name: `_acme-challenge${parts.sub ? `.${parts.sub}` : ''}`, content: `${keyAuthorization}`});
		},
		challengeRemoveFn: async (authz, challenge, keyAuthorization)=>{
			let parts = tldExtract(authz.identifier.value);
			await porkBun.deleteRecords(parts.domain, {type:'TXT', name: `_acme-challenge${parts.sub ? `.${parts.sub}` : ''}`, content: `${keyAuthorization}`});
		},
	});

	console.log('IIFE csr', cert.csr.toString())
	// console.log(cert.cert.split('\n\n')[0])
	// console.log('IIFE cert info', +AcmeClient.crypto.readCertificateInfo(cert.cert).notAfter/1000,  'IIFE cert:\n', String(cert.cert).split('\n\n') , /*'IIFE privKey\n', cert.key.toString()*/);
}catch(error){
	console.log('IIFE Error:', error)
}})()}

















