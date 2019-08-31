#! /usr/bin/env node

//you must add the absolute path to hosts.js on line 4, or this file will NOT work
const hosts = require("./models/hosts.js")


if (process.argv[2] == "--list"){
	console.log(hosts.listAll())
}
/* 
	if process.argv[2] == "--info"

	if process.agrv[2] == "--add"

	if process.argv[2] == "--remove"

	else{
		console.log("help text")
	}
*/