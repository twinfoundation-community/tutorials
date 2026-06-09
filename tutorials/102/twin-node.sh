#!/bin/sh

if [ -z "$1" ]; then
    echo "Usage twin-node.sh <bootstrap_command>. For help use twin-node.sh --help"
    exit 1
fi

command='node src/index.js'

# Pair with docker-compose mount of .env.bootstrap-legacy — supplies TWIN_FEATURES for
# bootstrap-legacy (node identity, admin user, wallet). Without it, bootstrap may not
# create a tenant or API key.
bootstrap_env='--load-env=./.env.local.bootstrap,./.env.bootstrap-legacy'
final_command="$command $* $bootstrap_env"

# -it requires a TTY; CI and some terminals fail with "input device is not a TTY".
if [ -t 0 ]; then
    docker compose run --rm -it twin-node sh -c "${final_command}"
else
    docker compose run --rm twin-node sh -c "${final_command}"
fi
