#!/usr/bin/env bash
# William Mantly <wmantly@gmail.com>
# MIT License
# https://github.com/wmantly

ME="$(basename "$(test -L "$0" && readlink "$0" || echo "$0")")"

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
        echo "Usage: $ME [domain] [cert]"
        echo "Usage: $ME chat.theta42.com cert_pem"
        echo "This will extract the cert and private key from the proxy for given domain"
        echo "Valid cert options, only one at a time: 'cert_pem', 'expiry', 'fullchain_pem', 'privkey_pem'"

        exit 0
fi

if [ "$2" == "" ]; then
        (>&2 echo "This command takes exectly 2 arguments. See $ME --help")

        exit 1
fi

redis-cli get "$1:latest" | python3 -c "import json;print( json.loads(input())['$2'] )"
