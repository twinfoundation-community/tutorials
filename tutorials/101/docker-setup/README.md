# README

This is an example on how to use Docker to run an instance of a TWIN Node using MySQL as data store.

## Steps

A/ Perform bootstrapping through

```sh
docker compose run --rm twin-node-bootstrap 
```

B/ Then run the node through

```sh
docker compose up -d twin-node 
```

## Environments

* [.env](./.env) Environment for running a Node with MySQL and IOTA testnet as DLT.
* [.env.local](./.env.local) Environment for running a Node with MySQL but storing all DLT-related entities locally.
* [.env.local.bootstrap](././env.local.bootstrap) Environment to perform bootstrap completely local.
* [.env.bootstrap-legacy](./.env.bootstrap-legacy) Environment to perform bootstrap legacy against IOTA and MySQL.
