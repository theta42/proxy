#! /usr/bin/env node

//you must add the absolute path to hosts.js on line 4, or this file will NOT work
const hosts = require("./models/hosts.js")

const command = process.argv[2];

(async function(command){
	if (command == "--list"){
		console.log(await hosts.listAll())
		process.exit(0)
	}

})(command)
/* 
	if process.argv[2] == "--info"

	if process.agrv[2] == "--add"

	if process.argv[2] == "--remove"

	else{
		console.log("help text")
	}
*/