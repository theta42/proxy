//Amos Jones 2019
//This file is the views file meant to handle the output of the CLI to the terminal


// <data> in this function is the output of hosts.listALL, array of hostnames
async function list(data){
	for (i = 0; i < data.length; i++){
		console.log(data[i])
	}
}

//<data> in this function is the dict of attributes for a host, data.host, data.ip, data.username
//data.username currently comes from process.env.USER, the linux username, this is a place holder
async function add(data){
	console.log(`NEW HOST ADDED SUCCESSFULLY`)
	console.log(`${data.host} @ ${data.ip} has been added by ${username}`)
}

async function info(data, line){
	console.log(`${data.host}     ${line.ip}  ${line.updated}  ${line.username}`)
}

async function ppHeader(){
	console.log('Hostname    IP    updated    created by')
}

async function remove(data){

}

async function help(){
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

}

module.exports = {list, add, info, ppHeader, remove, help}