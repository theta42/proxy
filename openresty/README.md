The folder will hold a link to the openresty conf file. Nothing in here will be
tracked, and edits are only valid on you local VM. The contents of this folder
is also reset during each provision run. Be mind full of that when making
changes here.

To apply any changes made in this folder, run the following command from outside
the VM:

`vagrant ssh -c "sudo service openresty restart"`
