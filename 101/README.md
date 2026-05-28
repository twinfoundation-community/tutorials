# tutorials.101

101 Tutorial - Deploying a local TWIN Node using Docker and MySQL as data store.

## Screencast

[Watch Video](https://www.youtube.com/watch?v=FU3hBnrjJ8k)

## Bootstrap Howto

See [Bootstrap Recipes](./HOWTO-bootstrap-node.md)

## Troubleshooting

It is necessary to grant permissions to the `twin` user to create DB i.e.

```sql
GRANT ALL PRIVILEGES ON twin.* TO 'twin'@'%'; 
```

In case the bootstrap tool raises exceptions stack traces can be consulted via

```sh
docker compose logs twin-node-bootstrap
```
