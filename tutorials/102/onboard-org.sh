#!/bin/sh

if [ "$#" -ne 3 ]; then
    echo "Usage: onboard-org.sh <organization-did> <user-name> <user-password>"
    exit 1
fi

set -e

ORG_DID="$1"
USER_NAME="$2"
USER_PASSWORD="$3"

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
TWIN_NODE="${SCRIPT_DIR}/twin-node.sh"

# 1. Add verification methods to the organization's identity

# Authentication as data provider or consumer in Dataspace exchanges.
echo "➡️  Adding 'trust-assertion' verification method"
"$TWIN_NODE" identity-verification-method-create --identity="$ORG_DID" --verification-method-id="trust-assertion"

# Attestation assertions, e.g. when tokenizing a document as an MLETR record.
echo "➡️  Adding 'attestation-assertion' verification method"
"$TWIN_NODE" identity-verification-method-create --identity="$ORG_DID" --verification-method-id="attestation-assertion"

# Immutable proofs that enable data verifiability.
echo "➡️  Adding 'immutable-proof-assertion' verification method"
"$TWIN_NODE" identity-verification-method-create --identity="$ORG_DID" --verification-method-id="immutable-proof-assertion"

# 2. Add an encryption key for blob storage at rest, to encrypt documents.
echo "➡️  Adding 'blob-encryption' key"
"$TWIN_NODE" vault-key-create --identity="$ORG_DID" --key-id="blob-encryption" --key-type="ChaCha20Poly1305"

# 3. Create a tenant for the organization
echo "➡️  Creating tenant"
TENANT_OUTPUT=$("$TWIN_NODE" tenant-create --organization-id="$ORG_DID")
echo "$TENANT_OUTPUT"
TENANT_ID=$(echo "$TENANT_OUTPUT" | tr -d '\r' | grep -i "Tenant ID:" | head -n1 | sed 's/.*Tenant ID:[[:space:]]*//')

if [ -z "$TENANT_ID" ]; then
    echo "Error: could not determine the Tenant ID from tenant-create output." >&2
    exit 1
fi

# 4. Create the admin user identity
echo "➡️  Creating admin user identity"
USER_OUTPUT=$("$TWIN_NODE" identity-create)
echo "$USER_OUTPUT"
USER_DID=$(echo "$USER_OUTPUT" | tr -d '\r' | grep -i "DID:" | head -n1 | sed 's/.*DID:[[:space:]]*//')

if [ -z "$USER_DID" ]; then
    echo "Error: could not determine the user DID from identity-create output." >&2
    exit 1
fi

# 5. Add a verification method for the user (not strictly necessary)
echo "➡️  Adding 'sign-0' verification method for the user"
"$TWIN_NODE" identity-verification-method-create --identity="$USER_DID" --verification-method-id="sign-0"

# 6. Create the user with login and password
echo "➡️  Creating user"
"$TWIN_NODE" user-create --user-identity="$USER_DID" --organization-identity="$ORG_DID" --email="$USER_NAME" --password="$USER_PASSWORD" --scope="tenant-admin" --tenant-id="$TENANT_ID"

echo
echo "🎉 Organization onboarded."
echo "Organization Identity: $ORG_DID"
echo "Tenant ID: $TENANT_ID"
echo "User Identity: $USER_DID"
echo "User: $USER_NAME"
