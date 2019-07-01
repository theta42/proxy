apt_package 'redis-server'

template '/etc/redis/local.conf' do
	source 'redis/local.conf'
end

if node['redis']['unix']['perm']
	bash 'append_to_config' do
	  user 'root'
	  code <<~EOF
	      echo "include /etc/redis/local.conf" >> /etc/redis/redis.conf
	  EOF
	  not_if 'grep -q "/etc/redis/local.conf" /etc/redis/redis.conf'
	end
end

systemd_unit 'redis-server.service' do
	action :restart
end
