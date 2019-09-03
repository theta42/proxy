#! /usr/bin/env node

//you must add the absolute path to hosts.js on line 4, or this file will NOT work
const hosts = require("./models/hosts.js")

const command = process.argv[2];

(async function(command){
	if (command == "--list"){
		try{
		console.log(await hosts.listAll())
		process.exit(0)
		} catch(e){
			console.error(e)
			process.exit(2)
		}
	} else if (command == "--add"){
		try{
			let data = {'host': process.argv[3],
						'ip': process.argv[4],
						'username': process.env.USER}
			console.log(await hosts.add(data))
			process.exit(0)
		} catch (e){
			console.error(e)
			process.exit(2)
		}
	} else {
		console.log("PLACEHOLDER FOR HELP TEXT")
		process.exit(0)
	}
})(command)
/* 
	if process.argv[2] == "--info"
s
	if process.argv[2] == "--remove"

	else{
		console.log("help text")
	}
*/