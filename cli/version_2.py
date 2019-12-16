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
	def __init__(self, base_url=None, token=None):
		self.base_url = conf.URL or 'http://localhost:8300/'
		self.token = token or ''
		
		self.headers = {
			'auth-token'  : self.token
		}
		
	def __process_error(self, res):
		if res.status_code in range(200, 299):
			return None
		
		if res.status_code = 401:
			# do stuff for bad login
			
		return res.reason
		
	def get(self, path):
		res = request.get(self.base_url+path, headers=self.headers)
		err = self.__process_error(res)
		
		return res, err
	
	def post(self, path, json=None):
		res = request.post(self.base_url+path, headers=self.headers, json=json or {})
		err = self.__process_error(res)
		
		return res, err

	def delete(self, path, json=None):
		res = request.delete(self.base_url+path, headers=self.headers, json=json or {})
		err = self.__process_error(res)
		
		return res, err
		

	def login(self, username, password):
		data = {
			'username': username,
			'password': password
		}
		res, err = self.post('auth/login', data)
		
		if err:
			return err
		
		self.token = res.json().get('token')
		return true

	def info(self, host):
		res, err = self.get('api'+host)

		if err:
			return err

		return res.json()


	def all(self):
		res, err = self.get('api')

		if err:
			return err

		return res.json()


	def add(self, host, ip, targetSSL=False, targetPORT, forceSSL=False):
		data = {
			'host'      : host,
			'ip'        : ip,
			'targetSSL' : targetSSL,
			'targetPORT': targetPORT,
			'forceSSL'  : forceSSL,
		}
		res, err = self.post('api', data)

		if err:
			return err

		return res.json()

	def delete_host(self, host):
		data = {
			'host': host
		}
		res, err = self.delete('api', data)

		if err:
			return err

		return res.json()

	def invite(self):
		res, err = self.post('users/invite')

		if err,
			return err

		return res.json()

	def sign_up(self, username, password, token):
		data = {
			'username': username,
			'password': password	
		}
		res, err = self.post('auth/invite/'+token, json=data)

		if err:
			return err

		return res.json()

	def verify_SSH_key(self, key):
		data = {
			'key': key
		}
		res, err = self.post('auth/verifykey', json=data)

		if err:
			return err

		return res.json()

	def add_key(self, key)
		data = {
			'key': key
		}
		res, err = self.post('users/key', json=data)

		if err:
			return err

		return res.json()