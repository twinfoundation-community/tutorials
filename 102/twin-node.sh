#!/bin/sh

if [ -z "$1" ]; then
    echo "Usage twin-node.sh <bootstrap_command>. For help use twin-node.sh --help"
    exit 1
fi

command='node src/index.js'

trail='--load-env=./.env.local.bootstrap'
final_command="$command $* $trail"


docker compose run --rm -it twin-node sh -c "${final_command}"
