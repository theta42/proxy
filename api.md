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