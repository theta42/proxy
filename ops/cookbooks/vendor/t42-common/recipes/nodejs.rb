version = {
	8 => {
		'version' => '8.16.0',
		'url' => 'https://nodejs.org/dist/latest-v8.x/node-v8.16.0-linux-x64.tar.gz',
		'checksum' => 'b391450e0fead11f61f119ed26c713180cfe64b363cd945bac229130dfab64fa'
	},
	10 => {
		'version' => '10.15.3',
		'url' => 'https://nodejs.org/dist/latest-v10.x/node-v10.15.3-linux-x64.tar.gz',
		'checksum' => '6c35b85a7cd4188ab7578354277b2b2ca43eacc864a2a16b3669753ec2369d52'
	}
}

unless node['nodejs']['working-dir'][0] == '/'
	node.override['nodejs']['working-dir'] = "#{node['working-dir']}/#{node['nodejs']['working-dir']}"
end

unless node['nodejs']['install_version']
	node.default['nodejs']['install_version'] = 8
end

unless version.key?(node['nodejs']['install_version'])
	raise <<~EOH
		Unsupported NodeJS version #{node['nodejs']['install_version']}.
		Supports #{version.keys}.
	EOH
end

set_version = version[node['nodejs']['install_version']]

node.default['nodejs']['install_method'] = 'binary'
node.default['nodejs']['version'] = set_version['version'].to_str
node.default['nodejs']['binary']['url'] = set_version['url']
node.default['nodejs']['binary']['checksum'] = set_version['checksum']

node.default['nodejs']['env_path'] = "/opt/theta42/#{node['app']['name']}/env/node"

include_recipe "nodejs"

directory node['nodejs']['env_path'] do
	recursive true
end

file "#{node['nodejs']['env_path']}/package.json" do
  owner 'root'
  group 'root'
  mode 0755
  content ::File.open("#{node['nodejs']['working-dir']}/package.json").read
  action :create
end

execute 'Install NPM package.json' do
	cwd node['nodejs']['env_path']
	command "npm --prefix #{node['nodejs']['env_path']} install #{node['nodejs']['env_path']}"
end

directory "/var/log/node/#{node['app']['name']}" do
	recursive true
end
