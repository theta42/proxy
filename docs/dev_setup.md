# Development environment setup

This project used vagrant for as standard development environment. This should
easy setting things up and reduce environment related errors.

## What you need

There are 3 things you will need to get before your local environment is up and
running.

### Git

This should already be installed on your system. If you are using Windows,
install [git bash for windows](https://git-scm.com/download/win)

### VirtualBox

Virtual box will be used to create a manged Linux VM on your computer. Please
install version 5.9 as version 6 is not supported.

### Vagrant

Vagrant is used to managed the local virtual environment and provision the VM.
**MAKE SURE GIT VIRTUAL BOX ARE INSTALLED FIRST!!!** At install time, vagrant
will integrate with them.

## Usage

Once you have everything installed and the projected cloned on your local
computer, open a terminal( Git Bash for windows users ) and move to the root of
the project.

### Chef secrets

This project like many other used secret API tokens that we do want tracked in
the git repo. in the root of the project, create a file called 'secrets.json' 
and populate like so:

```json
{
	"django": {
		"github": {
			"id": "<ID>",
			"secret": "<SECRET>",
			"token": "<TOKEN>"
		}
	}
}

```

### Basic vagrant usage and commands

We will interact with the project using vagrant. The work flow is `vagrant up`
creates a VM for your project and runs the provisioner to set everything up.
This command should be ran after the project is cloned or when you sit down to 
start development. This command may take some time to complete depending on how 
complex the project is. Once the VM is set up, you may now interact with it. 
Vagrant will forward ports from the project to the user localhost address. For
example with this project, port 80 from the container will be mapped to
localhost:8000 and you will be able to access there. If you make a change to any
provisioning chef recipes, `vagrant provision` will need to ran. This will
run the chef provisioner on the VM making any changes needed. 

Because we use the `secrets.json` file to store untracked configuration, all
vagrant command need to be ran where in the root of the project, where
`secrets.json` lives.

### `vagrant up`

Will start the local VM, creating it if needed. This command should always be
ran when a development session is started.

### `vagrant provision`

Will run the chef-solo provisioner. This will need to be ran anytime the chef 
recipes or roles are changed.

### `vagrant status`

Will show you the status of local manged VM

### `vagrant halt`

Will shutdown the local VM. This should be done when you are finished working on
the project so you dont have a VM running in the background eating CPU/RAM and
battery. `vagrant up` can be used later to turn the VM back on.

### `vagrant destroy`

This will shutdown the VM and delete it. This command is useful if you have 
messed up the VM and want to start from scratch. Or if you are done with the
project and want to free space from the computer.

### `vagrant ssh`

This will bring you into the local VM as the vagrant user. The vagrant user has
sudo. Use this only for debugging! **DO NOT INSTALL OR CHANGE THE STATE OF
PROJECT OR VM FROM HERE!!!!** that will break the concept of provisioning make 
chef useless. Also make installation and configuration changes with chef. 