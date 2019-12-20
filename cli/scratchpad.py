curl -H "Content-Type: application/json" -X POST -d '{"username": "test8", "password": "mypassword"}' http://localhost:8300/auth/login

>>> r = requests.post('localhost:8300/auth/login', json={"username": "test8", "password": "mypassword"})

		username = input('username: ')
		password = getpass.getpass('password: ')

#Initialize the variable to store the auth token 
token = ''

r = requests.post('http://localhost:8300/auth/login', json={"username": "test8", "password": "mypassword"})
print(r.content)
print(r.json())

curl -H "auth-token: 8eff4f16-086d-40fd-acbd-7634b9a36117" https://admin.rubyisforpussys.com/api/mine.com

amos:password@718it.biz:9822


zfs send stuffpool/Media@Dec1619 | ssh amos@718it.biz -p 9822 "zfs receive -F stuffpool/Media"


sudo zfs allow -u <USER> send,snapshot,hold <POOL>/<dataset>