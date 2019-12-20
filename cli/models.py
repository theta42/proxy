#!/usr/bin/env python3


# Proxyctrl - API backed CLI for the proxy container
# version 0.1
# This program aims to allow for the ease of use of the proxy via terminal interface
# Author - Amos Jones
# Project Supervisor - William Mantly
# 12/19/2019

# import python3 libraries
import requests

#class proxyctrl handles calls to the api
class model:
	# Starting here, these functions are internal to the class and should not be accessed from outside 
	def __init__(self, base_url=None, token=None):
		self.base_url = base_url or 'http://localhost:8300/'
		self.token = token or ''
		
		self.headers = {
			'auth-token'  : self.token
		}
		
	def __process_error(self, res):
		if res.status_code in range(200, 299):
			return None
		
		if res.status_code == 401:
			# do stuff for bad login
			pass
		return res.reason

	def __build_headers(self):
		self.headers['auth-token'] = self.token
		# explore using for header in self.headers pattern
		
	def __get(self, path):
		self.__build_headers()
		res = requests.get(self.base_url+path, headers=self.headers)
		err = self.__process_error(res)
		
		return res, err
	
	def __post(self, path, json=None):
		self.__build_headers()
		res = requests.post(self.base_url+path, headers=self.headers, json=json or {})
		err = self.__process_error(res)
		
		return res, err

	def __delete(self, path, json=None):
		self.__build_headers()
		res = requests.delete(self.base_url+path, headers=self.headers, json=json or {})
		err = self.__process_error(res)
		
		return res, err
		
	# Starting here, these functions are called from proxyctrl.py
	def login(self, username, password):
		data = {
			'username': username,
			'password': password
		}
		res, err = self.__post('auth/login', data)
		
		if err:
			return err

		self.token = res.json().get('token')
		return True

	def info(self, host):
		res, err = self.__get('api'+host)

		if err:
			return err

		return res.json()


	def all(self):
		res, err = self.__get('api')

		if err:
			return err

		return res.json()


	def add(self, host, ip, targetPort, targetSSL='False', forceSSL='False'):
		data = {
			'host'      : host,
			'ip'        : ip,
			'targetPort': targetPort,
			'targetSSL' : targetSSL or 'False',
			'forceSSL'  : forceSSL or 'False',
		}
		res, err = self.__post('api', data)
		print(res.content)

		if err:
			return err

		return res.json()

	def delete_host(self, host):
		data = {
			'host': host
		}
		res, err = self.__delete('api', data)

		if err:
			return err

		return res.json()

	def invite(self):
		res, err = self.__post('users/invite')

		if err:
			return err

		return res.json()

	def sign_up(self, username, password, token):
		data = {
			'username': username,
			'password': password	
		}
		res, err = self.__post('auth/invite/'+token, json=data)

		if err:
			return err

		return res.json()

	def verify_SSH_key(self, key):
		data = {
			'key': key
		}
		res, err = self.__post('auth/verifykey', json=data)

		if err:
			return err

		return res.json()

	def add_key(self, key):
		data = {
			'key': key
		}
		res, err = self.__post('users/key', json=data)

		if err:
			return err

		return res.json()