#!/bin/sh

if [ -z "$1" ]; then
    echo "Usage twin-node.sh <bootstrap_command>. For help use twin-node.sh --help"
    exit 1
fi

command='node src/index.js'

if [ "$1" = "bootstrap-legacy" ]; then
    bootstrap_env='--load-env=./.env.local.bootstrap,./.env.bootstrap-legacy'
else
    bootstrap_env='--load-env=./.env.local.bootstrap'
fi
final_command="$command $* $bootstrap_env"

# Only allocate a TTY when one is attached, so the output can be captured
# (e.g. from a command substitution in onboard-org.sh) without docker failing
# with "the input device is not a TTY".
if [ -t 0 ] && [ -t 1 ]; then
    tty_flag='-it'
else
    tty_flag='-i'
fi

docker compose run --rm $tty_flag twin-node sh -c "${final_command}"
