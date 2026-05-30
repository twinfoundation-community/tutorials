# tutorials.103

103 Tutorial - Deploying a TWIN Node on Kubernetes using MySQL as data store.

This is the Kubernetes version of [tutorial 101](../101/). The node configuration and the
bootstrap steps are the same; only the packaging differs - a `Deployment`, a MySQL
`StatefulSet`, a `Service` and an `Ingress` instead of a `docker compose` file.

## Setup

See [Kubernetes Setup](./k8s-setup/).

## Bootstrap

In the Docker tutorial you bootstrap the node by running a one-shot container
(`docker compose run --rm twin-node-bootstrap`). On Kubernetes the same work is done by the
`bootstrap` init container in [twin-node.yaml](./k8s-setup/twin-node.yaml), which runs the
recipe from [101/HOWTO-bootstrap-node.md](../101/HOWTO-bootstrap-node.md) before the server
container starts. It is guarded by a marker file on the data volume so it only runs once.

## Troubleshooting

### "The node identity is enabled in config but is not set"

Two distinct things cause this:

1. **The bootstrap never set the identity.** `bootstrap-legacy` creates the node identity
   but does not *set* it. You must run `node-set-identity` (and `node-set-tenant`) - which
   is exactly what the `bootstrap` init container does. See
   [HOWTO-bootstrap-node.md](../101/HOWTO-bootstrap-node.md).

2. **The node identity was set, but on the wrong volume.** The node identity is recorded in
   the engine state file (`engine-state.json`) under `TWIN_STORAGE_FILE_ROOT`. The image
   bakes `TWIN_STORAGE_FILE_ROOT=/twin-node/data` as a real container env var, and a value
   in a mounted `.env` *file* does **not** override an already-set `process.env`. So unless
   you set `TWIN_STORAGE_FILE_ROOT` as a real container env var pointing at your mounted
   volume (as the manifest does), the bootstrap writes the state to an ephemeral path and
   the server never sees it. Check which file the server loads:

   ```sh
   kubectl -n twin logs deploy/twin-node -c twin-node | grep "Loading state"
   # -> Loading state from file storage with filename "/var/lib/twin/engine-state.json"
   ```

   (This is why the Docker tutorial "just works": `docker compose`'s `env_file:` promotes
   `.env` entries to real environment variables, which *do* override the image's value. A
   ConfigMap mounted as a file does not.)

### `twin` user cannot create the database

As in tutorial 101, the `twin` user needs privileges on the `twin` database:

```sql
GRANT ALL PRIVILEGES ON twin.* TO 'twin'@'%';
```

The manifest avoids this by setting `MYSQL_DATABASE=twin` on the MySQL container, which
grants the `twin` user access to that database automatically.

### Inspecting the bootstrap

```sh
kubectl -n twin logs deploy/twin-node -c bootstrap
```
