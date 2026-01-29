# README

This is an example on how to use Docker to run an instance of a TWIN Node using MySQL as data store.

## Steps

Perform bootstrapping through

```sh
docker compose run twin-bootstrap --rm
```

Then run the node through

```sh
docker compose up -d twin-node 
```
