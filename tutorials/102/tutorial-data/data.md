> Created: 2026-06-11
> Last updated: 2026-06-19

# Test Data

Bootstrapped fresh on `twinfoundation/twin-node:0.0.3-next.62` (2026-06-19). All identities are
`did:entity-storage` (local bootstrap, no testnet). The live credentials are also mirrored in
`postman/TWIN-102-DSP.postman_environment.json`.

## Node Identity

DID: `did:entity-storage:0xcfc8af81329d09ac6fb505be6c479a9610b91a07685f9ab321e28069365ff76e`

Mnemonic: `attitude gospel share taste episode dish seminar buyer duck proud usual decline sample receive foot mushroom lucky endless valid become renew sugar just earn`

## Provider tenant (Data Provider)

- Tenant ID: `019edfc6c9517d558707f37cdd5ce348`
- API Key: `019edfc6c9517b53bd2ecbe367fc1ba1`
- Org DID (`prov_did`): `did:entity-storage:0x541bfcad1c9e9bbd56286431a9c0bf5901e17dfdba59015efe41da0f093a32ab`
- User DID: `did:entity-storage:0xb7e43c1d036a0b9e0f25d0a0fc3479db373e8881172eb76988227e71bf04953c`
- Login: `prov@example.com` / `yM5?NgPPAio+TmWx`

## Consumer tenant (Data Consumer)

- Tenant ID: `019edfc7173776e38d83f6c5fb279630`
- API Key: `019edfc7173772cc8dc11acef5e9fba8`
- Org DID (`cons_did`): `did:entity-storage:0x7deed401ea97d08446313b57fb208b506bca86c47bfd2ca615e4a41df4d37806`
- User DID: `did:entity-storage:0x19d51ec767a199e6494c08816cccd9a904ebd508d7397707d4c306c23ceba0de`
- Login: `cons@example.com` / `yM5?NgPPAio+TmWx`

## Dataset / Offer (published by the provider)

- Dataset ID: `https://twin.example.org/dataset-1342`
- Dataset type: `https://vocabulary.uncefact.org/Consignment`
- Offer ID: `urn:policy:test-policy-offer-1`
- App ID: `https://vtwt-1.virtualwatchtower.org`

## Bootstrap (script way)

Node + tenants + orgs + users were created via the CLI
(`docker compose run --rm -T twin-node sh -c "node src/index.js <cmd> --load-env=./.env.local.bootstrap"`):

1. `identity-create` (node) → node DID
2. `identity-verification-method-create` for `sign-0`, `auth-signing`, `trust-assertion`
3. `node-set-identity --identity=<node>`
4. `vault-key-create --identity=<node> --key-id="param-encryption" --key-type="ChaCha20Poly1305"`
5. Per tenant: `identity-create` (org) + `sign-0` + `trust-assertion` (`--verification-method-type="assertionMethod"`) → `tenant-create --organization-id=<org> --label="provider|consumer"` → `identity-create` (user) → `user-create --user-identity=<user> --organization-identity=<org> --email=... --password=... --scope="tenant-admin" --tenant-id=<tenant>`

Offer + dataset are published over REST (Postman A3/A4). Note: `node-set-tenant` from the old HOWTO
no longer exists; multi-tenant needs no node tenant. `tenant-create` requires `--organization-id`
(the org DID must be created first).
