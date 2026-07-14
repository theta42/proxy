This directory is currently unused.

The real OpenResty/nginx configuration for this project lives in
[`ops/nginx_conf/`](../ops/nginx_conf/) (`nginx.conf`, `autossl.conf`,
`proxy.conf`, `targetinfo.lua`, `hostfeatures.lua`). `ops/install.sh` symlinks
those files into place on a bare-metal host, and the Docker image copies them
in at build time — see [`DEPLOYMENT.md`](../DEPLOYMENT.md) for details.

If you're looking for how to change the nginx/Lua configuration, edit the
files under `ops/nginx_conf/` instead of this directory.
