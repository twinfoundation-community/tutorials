# Test Data

## Node Identity

```sh
did:entity-storage:0x0565892dfbcdcbdf9e93a2f332c68cc40935ba8d50d720bc38ed22bedc72071a
```

## Organization Identities

### Organization 1 (Data Provider)

Identity:

```sh
did:entity-storage:0x49686fbc29d48ff89813cd0743874507002cc4744aa515e8298e5b15a0eaf9ed
```

User Identity:

```sh
did:entity-storage:0x27fd6b9c9951165fae9e1160cee946308f6776d3abb72a61cf55853321743417
```

Login:

```sh
Email: admin@node
Password: 1234-A-1234-b-1234
```

Command line:

```sh
./twin-node.sh user-create --user-identity="did:entity-storage:0x27fd6b9c9951165fae9e1160cee946308f6776d3abb72a61cf55853321743417" --organization-identity="did:entity-storage:0x49686fbc29d48ff89813cd0743874507002cc4744aa515e8298e5b15a0eaf9ed" --email="admin@node" --password="1234-A-1234-b-1234" --scope="tenant-admin" --tenant-id="019eef73d629745a99083dc7faaae5d8"
```

Tenant:

```sh
➡️  Creating tenant
Tenant ID: 019eef73d629745a99083dc7faaae5d8
API Key: 019eef73d62974249c048af478181052
Organization ID: did:entity-storage:0x49686fbc29d48ff89813cd0743874507002cc4744aa515e8298e5b15a0eaf9ed
Label: Tenant
Public Origin:
```

### Organization 2 (Data Consumer)

Identity:

```sh
did:entity-storage:0x2c87e612974d3dcc4d1fd6f87b3bd6e4d955a2303eba5d36d6c3e4f4c4323ee2
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
./twin-node.sh user-create --user-identity="did:entity-storage:0xd9096602b0d2c4ab435bf588d7a49ac49017f50d77d5264a5a6346a591b84454" --organization-identity="did:entity-storage:0x2c87e612974d3dcc4d1fd6f87b3bd6e4d955a2303eba5d36d6c3e4f4c4323ee2" --email="damon@example.org" --password="yM5?NgPPAio+TmWx" --scope="tenant-admin" --tenant-id="019eefd48b727907b84beaaafa0ddcb6"
```

Tenant 2: (Data Consumer)

```sh
Tenant ID: 019eefd48b727907b84beaaafa0ddcb6
API Key: 019eefd48b72735d900579dcab1516bd
Organization ID: did:entity-storage:0x2c87e612974d3dcc4d1fd6f87b3bd6e4d955a2303eba5d36d6c3e4f4c4323ee2
Label:
Public Origin:
```

## Verifiable Credential Creation

Needed for data exchange operations:

Data Consumer:

```sh
./twin-node.sh identity-verifiable-credential-create --identity="did:entity-storage:0x2c87e612974d3dcc4d1fd6f87b3bd6e4d955a2303eba5d36d6c3e4f4c4323ee2" --verification-method-id="trust-assertion" --subject-json="./consumer.json"
```

Data Provider:

```sh
./twin-node.sh identity-verifiable-credential-create --identity="did:entity-storage:0x49686fbc29d48ff89813cd0743874507002cc4744aa515e8298e5b15a0eaf9ed" --verification-method-id="trust-assertion" --subject-json="./provider.json"
```
