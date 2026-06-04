# tutorials.101

101 Tutorial - Deploying a local TWIN Node using Docker and MySQL as data store.
This is an example on how to use Docker to run an instance of a TWIN Node using MySQL as data store.

## Screencast

[Watch Video](https://www.youtube.com/watch?v=FU3hBnrjJ8k)

## Bootstrap Steps

A/ Perform bootstrapping through

```sh
docker compose run --rm twin-node-bootstrap 
```

B/ Then run the node through

```sh
docker compose up -d twin-node 
```

This tutorial uses the so called legacy-bootstrap process. For understanding the step by step bootstrap please see [Bootstrap Recipes](../../common/HOWTO-bootstrap-node.md).

## Troubleshooting

### Database

It is necessary to grant permissions to the `twin` user to create DB i.e.

```sql
GRANT ALL PRIVILEGES ON twin.* TO 'twin'@'%'; 
```

### General bootstrapping

In case the bootstrap tool raises exceptions stack traces can be consulted via

```sh
docker compose logs twin-node-bootstrap
```

### IOTA

If there are issues with IOTA testnet faucet, etc. you can use the [local envs](../../common/.env.local).
