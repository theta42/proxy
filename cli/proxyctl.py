#!/usr/bin/env python3

# import python3 libraries
import sys
import os
import getpass
import requests

#import conf file
import conf

#class proxyctrl handles calls to the api
class proxyctrl:
	def __init__(self):
		self.base_url = conf.URL
		self.token = ''

	def login(self, username, password):
		# POST the request to proxy to authenticate the user
		r = requests.post(self.base_url+'/auth/login', json={"username": username, "password": password})
		
		# Check for the proper server response and login authenticated
		if (r.status_code == 200 and r.json().get('login') == True):
			self.token = r.json().get('token')
			print('Login Succesful: '+username)
		else:
			print('MY LOGIC HAS DIED!!!! WHY!!!! OH GOD WHY!!!!!')

# From this point forward we are interacting with the user

# username and password required to continue
# the user and pass correspond to the linux user management where the proxy app is runnning
# do not use local user info
username = input('username: ')
password = getpass.getpass('password: ')

#Instantiate proxyctrl class
console = proxyctrl()

#login to proxy app
console.login(username, password)