# apt_repository 'open resty repo' do
#   uri 'http://openresty.org/package/ubuntu'
#   key 'https://openresty.org/package/pubkey.gpg'
#   components   ['main']
# end

apt_package 'software-properties-common'

execute 'add key' do
	command 'wget -qO - https://openresty.org/package/pubkey.gpg | sudo apt-key add -'
end

execute 'add repo' do
	command 'add-apt-repository -y "deb http://openresty.org/package/ubuntu $(lsb_release -sc) main"; apt update'
end

apt_package 'openresty'

if node['web']['do_ssl']
	apt_package 'luarocks'

	execute 'install lua-resty-auto-ssl' do
	  command 'luarocks install lua-resty-auto-ssl'
	end

	directory '/etc/ssl' do
	  mode '0755'
	  action :create
	end

	execute 'defualt ssl' do
		command "openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt"
	end

	execute 'defualt ssl' do
		command "openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt"
	end

	template '/etc/openresty/autossl.conf' do
		source 'openresty/autossl.conf.erb'
	end
end

template '/etc/openresty/nginx.conf' do
	source 'openresty/nginx.conf.erb'
end

directory '/etc/openresty/sites-enabled' do
  mode '0755'
  action :create
end

directory '/var/log/nginx/' do
	mode '0775'
	action :create
end

if node['web']['t42-proxy']
	template '/etc/openresty/sites-enabled/proxy.conf' do
		source 'openresty/010-proxy.conf.erb'
	end
else
	template '/etc/openresty/sites-enabled/host.conf' do
		source 'openresty/simple-proxy.conf.erb'
	end
end

systemd_unit 'openresty' do
	action :reload
end
