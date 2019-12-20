#!/usr/bin/env python3

# Proxyctrl - API backed CLI for the proxy container
# version 0.1
# This program aims to allow for the ease of use of the proxy via terminal interface from any linux computer
# Author - Amos Jones
# Project Supervisor - William Mantly
# 12/19/2019
# most of the print statements in this code are placeholders for the view class methods

# import Python 3 libraries
import getpass

# import modules from CLI/ folder
import models
import views
import conf

# conf settings applied here:
base_url = conf.URL

class proxyctrl():
	def __init__(self):
		self.model = models.model(base_url)
		self.authenticated = False

	def login(self):
		#prompt the user for the username & password as stored in the proxy, not the local user if it is different
		username = input('username: ')
		password = getpass.getpass('password: ')
		
		#call the login() method of the model class
		self.authenticated = self.model.login(username, password)

		#check to see if login was successful
		if self.authenticated == True:
			print('i am authenticated')
			# Call View.Success
		else:
			print(self.authenticated + 'Proxy CLI will now exit.\n')
			# Call View.Failure
			exit()

	def logout():
		self.authenticated = False


# The Script Execution begins here
action = proxyctrl()
action.login()

# when the authenticated condition becomes False, this loop should exit
while action.authenticated == True:
	# Call view.prompt
	command = input('> ')
	print('I am now inside the COMMAND loop')
	# This code is just to get the ball rolling, clean it up
	if (command == 'logout'):
		# This should cause this loop to exit
		action.authenticated = False
	elif (command == 'info'):
		# Get info on a single host,
		pass 
	elif (command == 'all'):
		pass
	elif (command == 'add'):
		host = input('hostname: ')
		ip = input('ip ')
		targetPort = input('target port: ')
		targetSSL = input('target SSL(default is False): ')
		forceSSL = input('force SSL (default is False): ')
		result = action.model.add(host, ip, targetPort, targetSSL, forceSSL)
		print(result)
	elif (command == 'delete_host'):
		pass
	elif (command == 'invite'):
		pass
	elif (command == 'sign_up'):
		pass
	elif (command == 'verify_SSH_key'):
		pass
	elif (command == 'add_key'): 
		pass
	elif (command == 'help'):
		# Call view.quick_help
		# Detailed help per command planned in future update
		print('quick help text')
	

# Call View.Goodbye
print('I have exited the command loop')
exit()