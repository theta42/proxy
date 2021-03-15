
apt install libpam0g-dev build-essential redis-server luarocks --no-install-recommends wget gnupg ca-certificates curl git -y

curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs

wget -O - https://openresty.org/package/pubkey.gpg | sudo apt-key add -

sudo apt-get update

sudo apt-get -y install openresty

sudo luarocks install lua-resty-auto-ssl
sudo luarocks install lua-resty-socket
sudo luarocks install lua-socket
sudo luarocks install socket
sudo luarocks install luasocket
sudo luarocks install luasocket-unix
sudo luarocks install lua-cjson

mkdir /etc/ssl/

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt


wget -q https://raw.githubusercontent.com/theta42/proxy/master/ops/nginx.conf -O /etc/openresty/nginx.conf 
wget -q https://github.com/theta42/t42-common/blob/master/templates/openresty/autossl.conf.erb -O /etc/openresty/autossl.conf 
wget -q https://github.com/theta42/t42-common/blob/master/templates/openresty/010-proxy.conf.erb -O /etc/openresty/sites-enabled/000-proxy
wget -q https://github.com/theta42/proxy/blame/master/ops/proxy.service -O /etc/systemd/system/proxy.service

mkdir /var/log/nginx
mkdir /var/www

cd /var/www

git clone https://github.com/theta42/proxy.git

cd proxy/nodejs
npm install

systemctl start proxy.service
systemctl enable proxy.service
