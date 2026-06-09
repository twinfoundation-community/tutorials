# tutorials.102

## What's included

* [Dataspace App](./dataspace-example-app/) and sharing data among Nodes exemplified through the [Consumer Client Extension](./consumer-client/).

* `twin-node.sh` script to bootstrap and administer a Node. Use `twin-node.sh --help` to see the list of available commands.

## Getting started

### 1. Build extensions and start Docker

`docker-compose.yaml` volume-mounts local extension packages over the image. The node loads `dist/es/index.js`, so build after every source change:

```sh
cd dataspace-example-app && npm install && npm run build
cd ../consumer-client && npm install && npm run build
cd ..
docker compose up -d
```

Wait for the long-running node to log `The Web Server started on http://0.0.0.0:3000` (~2–3 min after start or restart).

### 2. Bootstrap

```sh
./twin-node.sh bootstrap-legacy
docker compose restart twin-node
```

`twin-node.sh` loads `./.env.local.bootstrap` and `./.env.bootstrap-legacy` (mounted from `../../common/`). The legacy env file supplies `TWIN_FEATURES` so bootstrap creates node identity, admin user, and provider tenant/API key.

A successful first-time bootstrap should show **Creating node identity** and **Creating tenant** before **Creating organisation identity**. If bootstrap starts at organisation identity and fails with *"The tenant ID is required when multi-tenancy is enabled"*, recover with:

```sh
./twin-node.sh tenant-create
./twin-node.sh bootstrap-legacy
docker compose restart twin-node
```

Or reset and bootstrap from scratch:

```sh
docker compose down -v
docker compose up -d
./twin-node.sh bootstrap-legacy
docker compose restart twin-node
```

You can also run individual commands via [step-by-step bootstrapping](../../common/HOWTO-bootstrap-node.md), for example:

```sh
./twin-node.sh tenant-create
```

### 3. Trust, dataset publish, consumer flow

1. Create consumer tenant, identities, users, and trust VCs per [tutorial data](./tutorial-data/data.md).
2. **Update** `tutorial-data/provider.json` and `tutorial-data/consumer.json` with org DIDs from **your** bootstrap output (`data.md` examples are stale).
3. Publish a dataset and register the ODRL offer — see **[dataset publish guide](./tutorial-data/dataset-publish.md)** (`dataset-publish.json` template + PAP step).
4. Log in as consumer and call `GET /consumer-client/query-data` with `Authorization: Bearer <JWT>`.

## Consumer client fixes (this branch)

The consumer extension wires a **multi-instance** control-plane RestClient so `startDataTransfer()` can POST to the catalogue `providerEndpoint` including `x-enc-tenant-token`. Without that, logs show the token in `providerEndpoint` but the loopback transfer POST fails with `missingTenantToken`.

Other tutorial fixes in code:

* Catalogue parsing for compacted DCAT keys (`dcat:distribution`, `odrl:hasPolicy`, string `accessService`).
* Negotiation URL pathname `/rights-management` (not appended to control-plane path).
* Consumer negotiation callback: host origin only (PNP appends `rights-management` itself).
* `datasetsHandled()` supports DCAT publish payloads and tokenizes with the provider tenant UUID.

## Federated catalogue dependency

On publish, federated catalogue **bakes** an encrypted tenant into each distribution `accessService` URL. If that token carries a partition **hash** instead of the raw tenant UUID, negotiation fails with `tenantNotFound`. Upstream fix: [twin-federated-catalogue PR #83](https://github.com/iotaledger/twin-federated-catalogue/pull/83).

## Tutorial data

* [Bootstrap examples](./tutorial-data/data.md) — replace DIDs with your run’s values.
* [Dataset publish](./tutorial-data/dataset-publish.md) — working publish payload and PAP offer registration.
