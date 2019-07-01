require 'securerandom'

default['db']['name'] = node['app']['name']
default['db']['user'] = node['app']['name']
default['db']['password'] = SecureRandom.hex(13)
