# tutorials.103

103 Tutorial - Deploying a TWIN Node on Kubernetes using MySQL as data store.

This is the Kubernetes version of [tutorial 101](../101/). The node configuration and the
bootstrap steps are the same; only the packaging differs - a `Deployment`, a MySQL
`StatefulSet`, a `Service` and an `Ingress` instead of a `docker compose` file.

Everything lives in the `twin` namespace and is created by [twin-node.yaml](./twin-node.yaml):
a MySQL `StatefulSet`, the node `Deployment` (with `wait-for-mysql` and `bootstrap` init
containers), a `Service` and an `Ingress`. The node configuration is the shared
[common/.env.local](../../common/.env.local), supplied through a `ConfigMap`; the few
settings that differ in-cluster are set as container env vars in the manifest.

## Configuration

The node uses the shared all-local profile [common/.env.local](../../common/.env.local) -
the same MySQL + entity-storage (no IOTA) profile used by the Docker tutorials. Rather than
publishing its own copy, this tutorial mounts that file at `/app/.env` and overrides only
the in-cluster specifics as real container env vars in [twin-node.yaml](./twin-node.yaml):

* `TWIN_MY_SQL_HOST` - the in-cluster MySQL service (`twin-node-db.twin.svc.cluster.local`).
* `TWIN_PUBLIC_ORIGIN` - the Ingress host (`http://twin.example.com/`).
* `TWIN_TENANT_ENABLED` - multi-tenant support, enabled here as the bootstrap creates a tenant.
* `TWIN_STORAGE_FILE_ROOT` - the mounted data volume (see the note under *Troubleshooting*).
* `TWIN_ADMIN_USER_NAME` / `TWIN_ADMIN_USER_PASSWORD` - the admin login created during bootstrap.

To run against IOTA testnet instead, mount [common/.env](../../common/.env) rather than
`common/.env.local` and provide the `TWIN_IOTA_*` settings.

## Setup

A/ Create the namespace and the env `ConfigMap` from the shared `common/.env.local`

The `Deployment` mounts the ConfigMap key `dotenv` at `/app/.env`, so the key must be named
exactly like this:

```sh
kubectl create namespace twin

kubectl create configmap twin-node-env -n twin \
  --from-file=dotenv=../../common/.env.local
```

B/ Apply the manifest

```sh
kubectl apply -f twin-node.yaml
```

C/ Watch it come up

```sh
kubectl -n twin get pods -w
```

The `bootstrap` init container runs once and prints the generated identities; the node then
starts and the pod becomes `Ready`:

```sh
kubectl -n twin logs deploy/twin-node -c bootstrap
kubectl -n twin logs deploy/twin-node -c twin-node
```

D/ Reach the node

Through the Ingress host (`twin.example.com` - change it in both `twin-node.yaml`'s
`TWIN_PUBLIC_ORIGIN` and the `Ingress` rule), or directly with a port-forward:

```sh
kubectl -n twin port-forward deploy/twin-node 3000:3000
curl -s http://localhost:3000/health
```

Log in with the `TWIN_ADMIN_USER_NAME` / `TWIN_ADMIN_USER_PASSWORD` set on the `bootstrap`
container in [twin-node.yaml](./twin-node.yaml).

## Bootstrap

In the Docker tutorial you bootstrap the node by running a one-shot container
(`docker compose run --rm twin-node-bootstrap`). On Kubernetes the same work is done by the
`bootstrap` init container in [twin-node.yaml](./twin-node.yaml), which runs the recipe from
[common/HOWTO-bootstrap-node.md](../../common/HOWTO-bootstrap-node.md) before the server
container starts. It is guarded by a marker file on the data volume so it only runs once.

### Re-running the bootstrap

The bootstrap is guarded by a marker file (`/var/lib/twin/.bootstrap-done`) on the
`twin-data` volume, so it runs only once. To bootstrap again from a clean slate, delete the
workloads and their volumes:

```sh
kubectl -n twin delete deploy/twin-node statefulset/twin-node-db
kubectl -n twin delete pvc twin-data twin-node-db-pvc
kubectl apply -f twin-node.yaml
```

## Troubleshooting

### "The node identity is enabled in config but is not set"

Two distinct things cause this:

1. **The bootstrap never set the identity.** `bootstrap-legacy` creates the node identity
   but does not *set* it. You must run `node-set-identity` (and `node-set-tenant`) - which
   is exactly what the `bootstrap` init container does. See
   [common/HOWTO-bootstrap-node.md](../../common/HOWTO-bootstrap-node.md).

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
