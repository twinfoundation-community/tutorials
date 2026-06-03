# Test Data

## Node Identity

```sh
did:entity-storage:0x55f61c5fe23ac3c2bf5da451109b7a79ee705d1afd4bedb2ddd6969478a09c4f
```

## Tenants

Tenant 1: (Data Provider)

```sh
➡️  Creating tenant

Tenant ID: 019e8c88a4fa77fc89a6334731fa30cd
API Key: 019e8c88a4fa70408a291977891260d3
Label:
Public Origin:
```

Tenant 2: (Data Consumer)

```sh
Tenant ID: 019e8c89185578118f3c165bde255ce9
API Key: 019e8c8918547bda894c44b4ab614265
Label:
Public Origin:
```

## Organization Identities

### Organization 1 (Data Provider)

Identity:

```sh
did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f
```

User Identity:

```sh
did:entity-storage:0x25382b99dd20ca68e76ff378e8cde2247cbd9ea256e805d1dd2975aef632e4c8
```

Login:

```sh
Email: jcantera@example.com
Password: yM5?NgPPAio+TmWx
```

Command line:

```sh
./twin-node.sh  user-create --user-identity="did:entity-storage:0x25382b99dd20ca68e76ff378e8cde2247cbd9ea256e805d1dd2975aef632e4c8" --organization-identity="did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f" --email="jcantera@example.com" --password="yM5?NgPPAio+TmWx" --scope="tenant-admin" --tenant-id="019e8c88a4fa77fc89a6334731fa30cd"
```

### Organization 2 (Data Consumer)

Identity:

```sh
did:entity-storage:0xf0a778c02c062482b3e4e446f6b441fc5e4853b6f5ebced1f00fc386a1375431
```

User Identity:

```sh
did:entity-storage:0xd9096602b0d2c4ab435bf588d7a49ac49017f50d77d5264a5a6346a591b84454
```

Login:

```sh
Email: damon@example.org
Password: yM5?NgPPAio+TmWx
```

Command line:

```sh
/twin-node.sh  user-create --user-identity="did:entity-storage:0xd9096602b0d2c4ab435bf588d7a49ac49017f50d77d5264a5a6346a591b84454" --organization-identity="did:entity-storage:0xf0a778c02c062482b3e4e446f6b441fc5e4853b6f5ebced1f00fc386a1375431" --email="damon@example.org" --password="yM5?NgPPAio+TmWx" --scope="tenant-admin" --tenant-id="019e8c89185578118f3c165bde255ce9"
```

## Verifiable Credential Creation

Needed for data exchange operations:

Data Consumer:

```sh
./twin-node.sh identity-verifiable-credential-create --identity="did:entity-storage:0xf0a778c02c062482b3e4e446f6b441fc5e4853b6f5ebced1f00fc386a1375431" --verification-method-id="trust-assertion" --subject-json="./consumer.json"
```

Data Provider:

```sh
./twin-node.sh identity-verifiable-credential-create --identity="did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f" --verification-method-id="trust-assertion" --subject-json="./provider.json"
```
