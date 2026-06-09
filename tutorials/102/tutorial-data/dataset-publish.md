# Dataset publish (Tutorial 102)

Working payload for `POST /dataspace-control-plane/app-datasets`. Use [`dataset-publish.json`](./dataset-publish.json) as the request body template.

## Before you publish

1. Replace `REPLACE_WITH_PROVIDER_ORG_DID` with the **provider org DID** from your bootstrap (not the stale examples in `data.md`).
2. Log in as provider and use `Authorization: Bearer <PROVIDER_JWT>`.
3. Register the same ODRL offer in PAP **before** running the consumer flow (step below). Dataset publish alone does not create a negotiable offer.

## Why this JSON shape

| Field | Notes |
|-------|--------|
| Expanded `@context` (`dcat:`, `dcterms:`, `odrl:`) | Short DSP 2025 keys alone failed validation in our runs; this matches federated-catalogue integration-style payloads. |
| `odrl:hasPolicy` `@type`: `Offer` | PAP expects `Offer`, not `odrl:Offer`. |
| `odrl:hasPolicy` `@id`: `urn:policy:tutorial-102-offer` | Policy IDs must use the `urn:policy:` namespace for PAP/PNP lookup. `urn:uuid:...` offers return `noOfferFound` on negotiation. |
| `target` | Required for transfer after negotiation. Without it, `startDataTransfer()` fails with `agreementMissingTarget`. Must match dataset `@id`. |
| `dcat:accessService` as plain URL string | `datasetsHandled()` tokenizes this URL with the provider tenant UUID before federated-catalogue publish. |

## Publish

```bash
PROVIDER_ORG="<your provider org DID>"
sed "s/REPLACE_WITH_PROVIDER_ORG_DID/$PROVIDER_ORG/g" tutorial-data/dataset-publish.json > /tmp/dataset-publish.json

curl -si -X POST "http://localhost:3000/dataspace-control-plane/app-datasets" \
  -H "Authorization: Bearer $PROVIDER_JWT" \
  -H "Content-Type: application/json" \
  -d @/tmp/dataset-publish.json
```

Expected: `HTTP 201` with `Location: urn:uuid:tutorial-102-test`.

To refresh catalogue tokens after code changes: `DELETE` the app-dataset, then `POST` again (PUT may skip federated-catalogue update).

## Register offer in PAP (required)

Negotiation looks up the offer by `@id` in the Policy Administration Point. Mirror the policy block from the JSON:

```bash
curl -si -X POST "http://localhost:3000/rights-management/policy/admin" \
  -H "Authorization: Bearer $PROVIDER_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"@context\": \"http://www.w3.org/ns/odrl.jsonld\",
    \"@type\": \"Offer\",
    \"@id\": \"urn:policy:tutorial-102-offer\",
    \"assigner\": \"$PROVIDER_ORG\",
    \"target\": \"urn:uuid:tutorial-102-test\",
    \"permission\": [{ \"action\": \"use\" }]
  }"
```

Expected: `HTTP 201`. If the offer already exists, `PUT /rights-management/policy/admin/urn:policy:tutorial-102-offer` with the same body returns `204`.

## Federated catalogue tenant token (bake)

On publish, federated catalogue **bakes** an encrypted tenant into each distribution `accessService` URL (`x-enc-tenant-token=...`) so consumers can reach the provider tenant on negotiation/transfer.

`datasetsHandled()` also tokenizes the URL with the provider UUID. If the catalogue bakes a **hashed** tenant instead of the UUID, negotiation fails with `tenantNotFound`. Fix upstream: [twin-federated-catalogue PR #83](https://github.com/iotaledger/twin-federated-catalogue/pull/83).

## After publish

Run the consumer flow: `GET /consumer-client/query-data` with consumer JWT (see tutorial README). Catalogue query should return the dataset with a tokenized `accessService` URL.
