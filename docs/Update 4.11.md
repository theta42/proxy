# Update 4.11

## Changes

The API routes have changed a bit and I will update the documentation soon.

All the endpoints now have key validations and return standardized errors. 
Any 500 class error should be reported as an issue.

End points for working with user have been added.

A GUI as need added and can be accessed from root of port 3000,
`http://server.ip:3000/` 

## How to get it

* Navigate to where the project is installed. This should be done as root.

* Pull the newest version from master

```bash
git pull origin master
```

* Move to the NodeJS folder

```bash
cd nodejs
```

* Update and install the NPM packages

```bash
npm update
npm install
```

* Run the migration script for the redis Hosts.

```bash
node migrations/host_1.js
```

* Restart the proxy service or container.

* Enoy the GUI!
