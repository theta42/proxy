require 'securerandom'

node.default['db']['name'] = "#{node['app']['name']}"
node.default['db']['user'] = "#{node['app']['name']}"
node.default['db']['root_password'] = SecureRandom.hex(13)
node.default['db']['password'] = SecureRandom.hex(13)
