unless node['php']['working-dir'][0] == '/'
	node.override['php']['working-dir'] = "#{node['working-dir']}/#{node['php']['working-dir']}"
end

[
	'php',
	'libapache2-mod-php',
].each do |pkg|
	apt_package pkg
end

systemd_unit 'apache2.service' do
	action :restart
end
