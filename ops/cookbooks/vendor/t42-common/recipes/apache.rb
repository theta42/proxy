[
	'apache2',
	'apache2-dev',
	'libapache2-mod-wsgi-py3',
].each do |pkg|
	apt_package pkg
end

file '/etc/apache2/sites-enabled/000-default.conf' do
	action :delete
end

execute 'enable apache mods' do
	command 'a2enmod expires'
end

if node['web']['do_ssl']
	apt_repository 'certbot apt repo' do
	  uri 'ppa:certbot/certbot'
	  repo_name 'ppa-certbot'
	  deb_src true
	  action :add
	end

	apt_update
	
	[
		'software-properties-common',
		'certbot',
		'python-certbot-apache',
	].each do |pkg|
		apt_package pkg
	end

	execute 'apache certbot' do
		command "sudo certbot certonly --standalone -d #{node['app']['domain']} --non-interactive --agree-tos --email #{node['web']['admin_email']}"
	end
end

if node['web']['socket.io']
	execute 'enable apache mods' do
		command 'a2enmod rewrite; a2enmod proxy_wstunnel; a2enmod proxy_http'
	end
end

template '/etc/apache2/sites-enabled/000-server.conf' do
	source 'apache/vhost.conf.erb'
end

systemd_unit 'apache2.service' do
	action :restart
end
