# proxy

A simple reverse proxy and https termination using openresty/nginx with a managment API and GUI. 

## API docs
[API docs](api.md)

## Server set up

The server requires:
* NodeJS 8.x
* inbound Internet access
* OpenResty
* redis
* lua rocks

This has been tested on ubuntu 16.04, but should work on any modern Linux
distro.
**Optional** Linux users for its user management, so this will
**ONLY** work on Linux, no macOS, BSD or Windows and require root.

The steps below are for a new ubuntu server, they should be mostly the same for
other distros, but the paths and availability of packages may vary. A dedicated
server is highly recommended (since it will make ever user a system user), a VPS
like Digital Ocean will do just fine.

* Install openresty

    [OpenResty® Linux Packages](https://openresty.org/en/linux-packages.html)

* These packages are needed for the PAM node package

    ```bash
    apt install libpam0g-dev build-essential
    ```

* Install redis

    ```bash
    apt install redis-server
    ```

* install lua plugin

```bash
apt install luarocks
sudo luarocks install lua-resty-auto-ssl
sudo luarocks install lua-resty-socket
sudo luarocks install lua-socket
sudo luarocks install socket
sudo luarocks install luasocket
sudo luarocks install luasocket-unix
sudo luarocks install lua-cjson
```

* openresty config

Set up fail back SSL certs

```bash
mkdir /etc/ssl/

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt

# openssl dhparam -out /etc/nginx/dhparam.pem 4096 # This takes a LONG time and is not needed.

```

Change the `/etc/openresty/nginx.conf to have this config`

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

add the SSL config file `/etc/openresty/autossl.conf`, contents from here
https://github.com/theta42/t42-common/blob/master/templates/openresty/autossl.conf.erb


Add the proxy config `/etc/openresty/sites-enabled/000-proxy` contents from here
https://github.com/theta42/t42-common/blob/master/templates/openresty/010-proxy.conf.erb
