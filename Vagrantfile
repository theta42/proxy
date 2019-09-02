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
  config.vm.box = "ubuntu/xenial64"
  config.vm.synced_folder '.', '/vagrant' # The vagrant dir just stopped automounting

  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # NOTE: This will enable public access to the opened port
  config.vm.network "forwarded_port", guest: 80, host: 8000

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  # Example for VirtualBox:
  #
  config.vm.provider 'virtualbox' do |vb|
    # Customize the amount of memory on the VM:
    vb.memory = '1024'
    vb.default_nic_type = "virtio"
    vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
  end
  #
  # View the documentation for the provider you are using for more
  # information on available options.

  # Enable provisioning with a shell script. Additional provisioners such as
  # Puppet, Chef, Ansible, Salt, and Docker are also available. Please see the
  # documentation for more information about their specific syntax and use.
  config.vm.provision "shell", inline: <<~SHELL
    if ! apt list ruby2.5 | grep installed; then
      apt-add-repository ppa:brightbox/ruby-ng -y
      apt-get update
      sudo apt-get install -y build-essential resolvconf ruby2.5 ruby2.5-dev gem
    fi

    if ! which berks >/dev/null; then
      gem install berkshelf --no-ri --no-rdoc
      # ln -s /opt/chef/embedded/bin/berks /usr/local/bin/berks
    fi

    cd /vagrant
    git submodule update --init --recursive

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
    chef.version = '14.12.3' # version 14.12.9 fails to run
    chef.cookbooks_path = [
      'ops/cookbooks/',
      'ops/cookbooks/vendor/'
    ]
    chef.roles_path ='ops/roles'
    chef.add_role('common')
    chef.json = {
      'working-dir': '/vagrant',
      'app': {
        'name': 'proxy',
        'run_user': 'vagrant',
        'domain': 'localhost',
      },
      'nodejs': {
        'working-dir': 'nodejs',
        'port': '8001',
        'install_version': 12
      },
      'redis':{
        'unix': {
          'perm': '777'
        }
      },
      'python': {
        # 'working-dir': 'django',
        'version': '2.7'
      },
      # 'db':{},
      # 'django': {
      #   'settings_path': 'project/settings',
      #   'email': {
      #     'host': 'smtp.gmail.com',
      #     'port': '587',
      #     'tls': 'True',
      #   },
      #   'allowed_hosts': [
      #     '*'
      #   ],
      #   'github': {
      #     'TEST_ORG': 'ByteTesting',
      #     'DISTRIBUTOR_ORG': 'ByteExercises',
      #     'SOURCE_ORG': 'ByteAcademyCo'
      #   }
      # },
      # 'web':{
      #   'admin_email': 'admin2342@example.com',
      #   'do_ssl': false,
      #   'static': [
      #     {'uri': '/static', 'path': 'django/staticfiles'},
      #   ],
      #   'wsgi': {
      #     'wsgi_path': 'django/project/wsgi.py',
      #   },
      #   'socket.io': {
      #     'host': 'localhost',
      #     'port': '8001',
      #   }
      # },
    }.deep_merge(secrets);
  end
end
