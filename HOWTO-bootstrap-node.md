# Steps to bootstrap a Node

1. Create an Identity

```sh
node src/index.js identity-create --load-env=./.env.bootstrap-legacy
````

2. Add a verification method

```sh
node src/index.js identity-verification-method-create --identity="did:entity-storage:0x6dd59a2859572904e0516d060af7427059630f122bd452ac0418b2094d2f0e68" --verification-method-id="sign-0"  --load-env=./.env.bootstrap-legacy

node src/index.js identity-verification-method-create --identity="did:entity-storage:0x6dd59a2859572904e0516d060af7427059630f122bd452ac0418b2094d2f0e68" --verification-method-id="auth-signing"  --load-env=./.env.bootstrap-legacy
```

3. Set Node Identity

```sh
 node-set-identity --identity="did:entity-storage:0x6dd59a2859572904e0516d060af7427059630f122bd452ac0418b2094d2f0e68" --load-env=./.env.bootstrap-legacy
```

4. Create a tenant

```sh
node src/index.js tenant-create --load-env=./.env.bootstrap-legacy
```

```sh
Tenant ID: 019e4a73a13b77f5989cec15a466cc71
API Key: 019e4a73a13b7212ab3c291629216bf9
Label:
Public Origin:
```

5. Set tenant

```sh
node src/index.js node-set-tenant --tenant-id="019e4a73a13b77f5989cec15a466cc71"
```

6. Create and Admin User

6.1 Create an organization DID

```sh
node src/index.js identity-create --load-env=./.env.bootstrap-legacy

node src/index.js identity-verification-method-create --identity="did:entity-storage:0xf53d09732675c67f83ee3894e013b8244f543f3148c6ceca53367a93dec984bb" --verification-method-id="sign-0"  --load-env=./.env.bootstrap-legacy
```

6.2 Create a user DID

```sh
node src/index.js identity-create --load-env=./.env.bootstrap-legacy

node src/index.js identity-verification-method-create --identity="did:entity-storage:0x56a70c43e443f75804405482ee4e347a1f9c2b156b56a7ad299fb298330ae491" --verification-method-id="sign-0"  --load-env=./.env.bootstrap-legacy
```

7. Create User with login and pass

```sh
node src/index.js user-create --user-identity="did:entity-storage:0x56a70c43e443f75804405482ee4e347a1f9c2b156b56a7ad299fb298330ae491" --organization-identity="did:entity-storage:0xf53d09732675c67f83ee3894e013b8244f543f3148c6ceca53367a93dec984bb" --email="jcantera@example.com" --password="yM5?NgPPAio+TmWx" --scope="tenant-admin" --tenant-id="019e4a73a13b77f5989cec15a466cc71" --load-env=./.env.bootstrap-legacy
```

```sh
Email: jcantera@example.com
Password: yM5?NgPPAio+TmWx
```
