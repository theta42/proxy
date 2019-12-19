#!/usr/bin/env python3

# Proxyctrl - API backed CLI for the proxy container
# version 0.1
# This program aims to allow for the ease of use of the proxy via terminal interface from any linux computer
# Author - Amos Jones
# Project Supervisor - William Mantly
# 12/19/2019

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
		if self.authenticated:
			print('i am authenticated')
		else:
			print('i am not authenticated')