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
			await hosts.add(data)
			console.log(data.host + " has been added successfully")
			process.exit(0)
		} catch (e){
			console.error(e)
			process.exit(2)
		}
	} else if (command == "--info") {
		try{
			let data = {'host': process.argv[3]}
			console.log(await hosts.getInfo(data))
			process.exit(0)
		}catch(e){
			console.error(e)
			process.exit(2)
		}

	} else {
		console.log("PLACEHOLDER FOR HELP TEXT")
		process.exit(0)
	}
})(command)
/* 
	if process.argv[2] == "--remove"

*/