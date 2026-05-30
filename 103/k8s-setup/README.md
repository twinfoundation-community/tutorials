# README

This is an example of how to run a TWIN Node on Kubernetes using MySQL as the data store.
It is the Kubernetes counterpart of the Docker setup in [tutorial 101](../../101/).

Everything lives in the `twin` namespace and is created by [twin-node.yaml](./twin-node.yaml):
a MySQL `StatefulSet`, the node `Deployment` (with `wait-for-mysql` and `bootstrap` init
containers), a `Service` and an `Ingress`. The node configuration is supplied through a
`ConfigMap` built from the env files in this directory.

## Steps

A/ Create the namespace and the env `ConfigMap` from the env files

The `Deployment` mounts the ConfigMap key `dotenv` at `/app/.env` and `dotenv.bootstrap` at
`/app/.env.bootstrap`, so the keys must be named exactly like this:

```sh
kubectl create namespace twin

kubectl create configmap twin-node-env -n twin \
  --from-file=dotenv=.env \
  --from-file=dotenv.bootstrap=.env.bootstrap
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

Through the Ingress host (`twin.example.com` - change it in both `.env` and
`twin-node.yaml`), or directly with a port-forward:

```sh
kubectl -n twin port-forward deploy/twin-node 3000:3000
curl -s http://localhost:3000/health
```

Log in with the admin user/password from [.env.bootstrap](./.env.bootstrap).

## Environments

* [.env](./.env) The node configuration. All-local (entity-storage) profile, i.e. all DLT
  entities are stored locally in MySQL with no IOTA dependency - the same profile as
  `101/docker-setup/.env.local`. To run against IOTA testnet instead, switch the connectors
  to `iota` as in `101/docker-setup/.env` and add the `TWIN_IOTA_*` settings.
* [.env.bootstrap](./.env.bootstrap) Bootstrap-only settings: the node features to enable
  and the admin login created during bootstrap.

## Re-running the bootstrap

The bootstrap is guarded by a marker file (`/var/lib/twin/.bootstrap-done`) on the
`twin-data` volume, so it runs only once. To bootstrap again from a clean slate, delete the
workloads and their volumes:

```sh
kubectl -n twin delete deploy/twin-node statefulset/twin-node-db
kubectl -n twin delete pvc twin-data twin-node-db-pvc
kubectl apply -f twin-node.yaml
```
