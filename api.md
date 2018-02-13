## invite
```bash
curl -H "Content-Type: application/json" -H "auth-token: 0b06eb2e-4ca4-4881-9a0f-b8df55431cd1" -X POST -d "{\"username\": \"william\", \"password\": \"palm7\"}" http://localhost:3000/users/invite

{"token":"5caf94d2-2c91-4010-8df7-968d10802b9d"}
```

## sing up
```bash
curl -H "Content-Type: application/json" -X POST -d "{\"username\": \"william\", \"password\": \"palm7\"}" http://localhost:3000/auth/5caf94d2-2c91-4010-8df7-968d10802b9d


```
## login
```bash
curl -H "Content-Type: application/json" -X POST -d "{\"username\": \"test8\", \"password\": \"palm7\"}" http://localhost:3000/auth/login

{"login":true,"token":"027d3964-7d81-4462-a6f9-2c1f9b40b4be"}
```

## verify SSH key
```bash
curl -H "Content-Type: application/json" -X POST -d "{\"key\":\"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDM9vboz5YGgESsrR2e4JOeP2qtmQo2S8BjI+Y/VxPQ6WbNFzAkXxDniHcnPCrhkeX36SKINvMjWnt4XOK2S+X+1tCoXJzqtcKKyK0gx8ijBxcWVPxsMWjMYTGSVSKiKnt6CyQzrbVGJMh3iAQ8Yv1JwH+6SAtMgT8it7iLyntNFJCesh4I/znEG58A5VBbdUle1Ztz9afjj1CZns17jk7KPm9ig5DmuvdvnMEfhFjfKv1Rp6S5nxacMoTP4tJNSEUh55IicoWk94ii5GwUVLYgyMmzdlA32TqVLFpU2yAvdA9WSnBaI/ZyktlfI7YAmK2wFBsagr9Pq1TcUAY6rZ/GTMjDxExgdYn/FxlufcuqeNJsJXs2A+0xDS/9mv/yGQzNZrL8DrVhY2OKKLoH4Q7enDbhSgEFmJUJMqPxuPEgLEvKfzcURSvIwRj1iCEw6S4dhdaLJl2RRBb1ZWBQbE5ogIbvAl7GFJUAhj3pqYJnd30VENv1MkK+IoCS7EEP0caqL9RNAId0Plud7q2XElHqzkYUE+z+Q/LvGgclXK1ZmZejNaMnV53wfhAevfwVyNGK9i5gbwc1P2lplIa5laXCcVWezqELEkTpdjp4AeKmMuCr8rY8EnLKIcKWEOsX5UumztCow6e1E55v3VeHvRZLpw4DZP7EE0Q8B/jPFWqbCw== wmantly@gmail.co\"}" http://localhost:3000/auth/verifykey

good 200 {"info":"4096 SHA256:dfdCYzt0atMBXVZTJzUxsu99IjXXFXpocSox5q+jOs8 wmantly@gmail.co (RSA)\n"}
bad 400 {"message":"Key is not a public key file!"} 
```