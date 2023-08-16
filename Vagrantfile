require 'json'
begin
  secrets = JSON.parse(File.read('secrets.json'))
  puts 'Loading secrets file'
rescue
  secrets = {}
  puts 'Secrets file not found'
end

class ::Hash
  def deep_merge(second)
    second.each do |key, value|
      if value.class == Hash and self[key.to_sym]
        self[key.to_sym].deep_merge(value)
      else
        self[key.to_sym] = value
      end
    end
    return self
  end
end

# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure("2") do |config|
  # The most common configuration options are documented and commented below.
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.

  # Every Vagrant development environment requires a box. You can search for
  # boxes at https://vagrantcloud.com/search.
  config.vm.box = "ubuntu/jammy64"
  config.vm.synced_folder '.', '/vagrant' # The vagrant dir just stopped automounting

  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # NOTE: This will enable public access to the opened port
  config.vm.network "forwarded_port", guest: 80, host: 8080
  config.vm.network "forwarded_port", guest: 443, host: 8443
  config.vm.network "forwarded_port", guest: 3000, host: 8300


  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  # Example for VirtualBox:
  #
  config.vm.provider 'virtualbox' do |vb|
    # Customize the amount of memory on the VM:
    vb.memory = '1024'
    vb.cpus = "2"
    # vb.default_nic_type = "virtio"
    vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
  end
  #
  # View the documentation for the provider you are using for more
  # information on available options.

  # Enable provisioning with a shell script. Additional provisioners such as
  # Puppet, Chef, Ansible, Salt, and Docker are also available. Please see the
  # documentation for more information about their specific syntax and use.
  config.vm.provision "shell", inline: <<~SHELL
    apt-get update
    if ! apt list ruby-dev | grep installed; then
      # apt-add-repository ppa:brightbox/ruby-ng -y
      sudo apt-get install -y build-essential resolvconf ruby-full gem
      gem install chef -v 17.10.0

    fi

    if ! which berks >/dev/null; then
      gem install ruby-shadow berkshelf --no-document
      ln -s /opt/chef/embedded/bin/berks /usr/local/bin/berks
    fi

    cd /vagrant

    cd /vagrant/ops/cookbooks
    rm -rf vendor
    rm -rf $HOME/.berksfile
    if [ -f ".Berksfile.lock" ]; then
      berks update
    else 
      berks install
    fi
    berks vendor vendor
  SHELL

  config.vm.provision 'chef_solo' do |chef|
    chef.arguments = "--chef-license accept"
    # chef.version = '15.7.31' # version 14.12.9 fails to run
    chef.cookbooks_path = [
      'ops/cookbooks/',
      'ops/cookbooks/vendor/'
    ]
    chef.roles_path ='ops/roles'
    chef.add_role('common')
    chef.json = {
      'working-dir': '/vagrant',
      'app': {
        'name': 't42-proxy',
        'run_user': 'root',
        'domain': 'proxy.local',
      },
      'python': {
        # 'working-dir': 'django',
        'version': '2.7'
      },
      'nodejs': {
        'working-dir': 'nodejs',
        'port': '3000',
        'install_version': 18,
        'exec_file': 'bin/www',
        'service': true,
      },
      'redis':{
        'unix': {
          'perm': '777'
        }
      },
      'web':{
        'admin_email': 'admin2342@example.com',
        'do_ssl': true,
        't42-proxy': true
      },
    }.deep_merge(secrets);
  end

  config.vm.provision "shell", inline: <<~SHELL
    cp -a /etc/openresty/. /vagrant/openresty
    rm -rf /etc/openresty
    ln -s /vagrant/openresty /etc/openresty
  SHELL
end
