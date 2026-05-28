// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { INegotiationCallback } from "@twin.org/dataspace-models";
import { DataspaceProtocolContractNegotiationStateType, IDataspaceProtocolOffer, IDataspaceProtocolAgreement } from "@twin.org/standards-dataspace-protocol";

export class NegotiationHandler implements INegotiationCallback {
    async onStateChanged(negotiationId: string, state: DataspaceProtocolContractNegotiationStateType, data?: { offer?: IDataspaceProtocolOffer; agreement?: IDataspaceProtocolAgreement; }): Promise<void> {
        console.log("Negotiation", negotiationId, "Now in state", state);
    }
    async onCompleted(negotiationId: string, agreementId: string): Promise<void> {
        console.log("Negotiation", negotiationId, "Now Completed", negotiationId, agreementId);
    }
    async onFailed(negotiationId: string, reason: string): Promise<void> {
        console.error("Negotiation", negotiationId, "Failed", reason);
    }
}