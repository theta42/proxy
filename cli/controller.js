#! /usr/bin/env node

//Import required modules
const hosts = require("../models/hosts")
const views = require("./views")

//set command variable
const command = process.argv[2];

(async function(command){
	if (command == "--list"){
		try{
			await views.list(await hosts.listAll())
			process.exit(0)
		} catch(e){
			console.error(e)
			process.exit(1)
		}
		
	} else if (command == "--ls-f"){
		try{
			let data = await hosts.listAll()
			let output =[]
			for (i =0; i > data.length; i++){
				line = await hosts.getInfo(data[i])
				output[i] = line
			}
			views.listFancy(output)
		} catch(e){
			console.error(e)
			process.exit(1)
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
			process.exit(1)
		}

	} else if (command == "--info") {
		try{
			let data = {'host': process.argv[3]}
			console.log(await hosts.getInfo(data))
			process.exit(0)
		}catch(e){
			console.error(e)
			process.exit(1)
		}

	} else if (command == '--remove'){
		try{
			let data = {'host': process.argv[3]}
			console.log(await hosts.remove(data))
			console.log(data.host + " has been removed successfully")
			process.exit(0)
		}catch(e){
			console.error(e)
			process.exit(1)
		}

	} else if (command == '--help'){
		console.log("hostctrl.js help text \n")
		console.log("\n")
		console.log("--help  :    This help text. \n")
		console.log("--list  :    Provides a list of all hosts in the database. \n")
		console.log("--add   :    Add a new host. Usage: --add <hostname> <ipaddress> \n")
		console.log("--info  :    Provides detailed info on a host. Usage: --info <hostname> \n")
		console.log("--remove:    Not yet implemented. Using this will raise an error \n")
		console.log("\n")
		console.log("Error code map: \n")
		console.log("0 -- ok \n")
		console.log("1 -- data error \n")
		console.log("127 -- invalid command used \n")
		process.exit(0)

	} else {
		console.error("Command not found. Use --help for options")
		process.exit(127)
	}
})(command)
/* 
	if process.argv[2] == "--remove"
	Removes a host from the database. Usage: --remove <hostname>
*/