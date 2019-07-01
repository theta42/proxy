mysql_service node['db']['name'] do
  # version '5.7'
  bind_address '127.0.0.1'
  port '3306'
  # data_dir '/data'
  initial_root_password node['db']['root_password']

  action [:create, :start]
end


bash 'Make mysql Database and User' do
	code <<~EOH
		mysql -h 127.0.0.1 -uroot -p"#{node['db']['root_password']}" -e "CREATE DATABASE #{node['db']['user']} /*\!40100 DEFAULT CHARACTER SET utf8 */;"
	    mysql -h 127.0.0.1 -uroot -p"#{node['db']['root_password']}" -e "CREATE USER #{node['db']['user']}@localhost IDENTIFIED BY '#{node['db']['password']}';"
	    mysql -h 127.0.0.1 -uroot -p"#{node['db']['root_password']}" -e "GRANT ALL PRIVILEGES ON #{node['db']['user']}.* TO '#{node['db']['user']}'@'localhost';"
	    mysql -h 127.0.0.1 -uroot -p"#{node['db']['root_password']}" -e "FLUSH PRIVILEGES;"

	EOH
	not_if "mysql -h 127.0.0.1 -uroot -p\"#{node['db']['root_password']}\" -e 'use #{node['db']['name']}'"
end
