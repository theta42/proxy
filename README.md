# proxy

## API docs
[API docs](api.md)

## Server set up

The server requires:
* NodeJS 8.x
* open ssh server(any modern version will do)
* inbound Internet access
* OpenResty
* redis
* lua rocks

This has been tested on ubuntu 16.04, but should work on any modern Linux distro. It used the Linux users for its user management, so this will **ONLY** work on Linux, no macOS, BSD or Windows.

The steps below are for a new ubuntu server, they should be mostly the same for other distros, but the paths and availability of packages may vary. A dedicated server is highly recommended (since it will make ever user a system user), a VPS like Digital Ocean will do just fine.

* Install other
    These packages are needed for the PAM node package
    ```bash
    apt install libpam0g-dev build-essential
    ```

* Install open ssh server
    ```bash
    apt install ssh
    ```

* Install openresty

    [OpenResty® Linux Packages](https://openresty.org/en/linux-packages.html)

* Install redis
    ```bash
    apt install redis-server
    ```

* install lua plugin
```bash
apt install luarocks
sudo luarocks install lua-resty-auto-ssl
```

* Configure sshd for tunneling


* openresty config

Set up fail back SSL certs
```bash
mkdir /etc/ssl/

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt

openssl dhparam -out /etc/nginx/dhparam.pem 4096

```


change the `/etc/openresty/nginx.conf to have this config`

```
#user  nobody;
worker_processes 4;

#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#pid        logs/nginx.pid;


events {
    worker_connections  1024;
}


http {
    client_max_body_size 4g;


    lua_shared_dict auto_ssl 100m;
    lua_shared_dict auto_ssl_settings 64k;

    resolver 8.8.4.4 8.8.8.8;

    init_by_lua_block {
        auto_ssl = (require "resty.auto-ssl").new()
	auto_ssl:set("storage_adapter", "resty.auto-ssl.storage_adapters.redis")
        auto_ssl:set("allow_domain", function(domain)
            return true
        end)
        auto_ssl:init()
    }

    init_worker_by_lua_block {
      auto_ssl:init_worker()
    }

    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    server {
      listen 127.0.0.1:8999;

      # Increase the body buffer size, to ensure the internal POSTs can always
      # parse the full POST contents into memory.
      client_body_buffer_size 128k;
      client_max_body_size 128k;

      location / {
        content_by_lua_block {
          auto_ssl:hook_server()
        }
      }
    }

    include       mime.types;
    default_type  application/octet-stream;

    #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                  '$status $body_bytes_sent "$http_referer" '
    #                  '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;
    include sites-enabled/*;

}

```


add the SSL config file `/etc/openresty/autossl.conf`

```
  ssl_protocols     TLSv1 TLSv1.1 TLSv1.2;
  ssl_prefer_server_ciphers  on;
  ssl_ciphers EECDH+CHACHA20:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5;

  ssl_certificate_by_lua_block {
    auto_ssl:ssl_certificate()
  }

  location /.well-known/acme-challenge/ {
    content_by_lua_block {
      auto_ssl:challenge_server()
    }
  }

  ssl_certificate /etc/ssl/resty-auto-ssl-fallback.crt;
  ssl_certificate_key /etc/ssl/resty-auto-ssl-fallback.key;

```


Add the proxy config `/etc/openresty/sites-enabled/000-proxy`


```
server {
	listen 80;
	listen 443 ssl;

	include autossl.conf;

	location / {
		resolver 10.0.3.1;  #8.8.4.4;  # use Google's open DNS server

		set $target '';
		access_by_lua '
		    local key = ngx.var.host
		    if not key then
			ngx.log(ngx.ERR, "no user-agent found")
			return ngx.exit(400)
		    end

		    local redis = require "resty.redis"
		    local red = redis:new()

		    red:set_timeout(1000) -- 1 second

		    local ok, err = red:connect("127.0.0.1", 6379)
		    if not ok then
			ngx.log(ngx.ERR, "failed to connect to redis: ", err)
			return ngx.exit(500)
		    end

		    local host, err = red:hget("proxy_host_"..key, "ip")
		    if not host then
			ngx.log(ngx.ERR, "failed to get redis key: ", err)
			return ngx.exit(500)
		    end

		    if host == ngx.null then
			ngx.log(ngx.ERR, "no host found for key ", key)
			return ngx.exit(400)
		    end
		    ngx.log(ngx.WARN, "==Found match!!!  ", key, host)
		    ngx.var.target = host
		';


		proxy_pass http://$target;
		proxy_set_header X-Real-IP  $remote_addr;
		proxy_set_header X-Forwarded-For  $remote_addr;
		proxy_set_header Host $host;
		add_header X-Target-Host $target;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
	}
}
```



## ref

https://blog.trackets.com/2014/05/17/ssh-tunnel-local-and-remote-port-forwarding-explained-with-examples.html
https://github.com/GUI/lua-resty-auto-ssl
