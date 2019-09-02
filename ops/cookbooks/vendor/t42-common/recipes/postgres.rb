execute 'add key' do
  command 'wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -'
end

execute 'add repo' do
  command 'echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" >> /etc/apt/sources.list.d/pgdg.list'
end


apt_update 'update' do
end.run_action(:update) if platform_family?('debian')

postgresql_server_install 'My PostgreSQL Server install' do
  initdb_locale 'en_US.utf8'
  action :install
end

postgresql_server_install 'Setup my PostgreSQL 9.6 server' do
  initdb_locale 'en_US.utf8'
  action :create
end

postgresql_access 'local_postgres_superuser' do
  comment 'Local postgres superuser access'
  access_type 'local'
  access_db 'all'
  access_user 'postgres'
  access_addr nil
  access_method 'ident'
end

postgresql_user 'DB user' do
  create_user node['db']['user']
  password node['db']['password']
  createrole true
end

# Hack for creating a database, this cook book is broken with debian...

execute 'add database' do
	command "createdb #{node['db']['name']}"
	user 'postgres'
	not_if "psql -lqt | grep -w \"#{node['db']['name']}\"", :user => 'postgres'
end

execute 'Grant DB user' do
	command "echo \"grant all privileges on database #{node['db']['name']} to #{node['db']['user']} ;\" | psql"
	user 'postgres'
end
