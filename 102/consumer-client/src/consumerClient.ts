// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { ILoggingComponent, LogLevel } from "@twin.org/logging-models";
import { IConsumerClientConstructorOptions } from "./IConsumerClientConstructorOptions.js";
import { ComponentFactory } from "@twin.org/core";
import {
  IDataspaceControlPlaneComponent,
  IDataspaceDataPlaneComponent,
} from "@twin.org/dataspace-models";
import { IConsumerClientComponent } from "./IConsumerClientComponent.js";
import { ContextIdStore } from "@twin.org/context";
import {
  DataspaceProtocolContexts,
  DataspaceProtocolContractNegotiationStateType,
  DataspaceProtocolTransferProcessTypes,
  IDataspaceProtocolAgreement,
  IDataspaceProtocolOffer,
  IDataspaceProtocolTransferError,
  IDataspaceProtocolTransferProcess,
} from "@twin.org/standards-dataspace-protocol";
import { randomUUID } from "node:crypto";

/**
 * Test App Activity Handler.
 */
export class ConsumerClient implements IConsumerClientComponent {
  private _logging: ILoggingComponent;

  private _dataspaceControlPlane: IDataspaceControlPlaneComponent;

  private _dataspaceDataPlane: IDataspaceDataPlaneComponent;

  public className(): string {
    return "ConsumerClient";
  }

  private _DATASET_ID = "https://twin.example.org/dataset-1";

  private _OFFER_ID = "urn:policy:test-policy-offer-1";

  private _PROVIDER_ENDPOINT =
    "http://host.docker.internal:3000/rights-management?x-api-key=019e5ee3ad5f7e94a197735372d895a9";

  private _CONSUMER_ENDPOINT = "http://host.docker.internal:3000";
  /* /rights-management?x-api-key=019e5f84a1657dd88e76e1f158abcda2*/

  /**
   * Create a new instance.
   * @param options The constructor options.
   */
  constructor(options?: IConsumerClientConstructorOptions) {
    this._dataspaceControlPlane =
      ComponentFactory.get<IDataspaceControlPlaneComponent>(
        options?.dataspaceControlPlaneComponentType ?? "dataspaceControlPlane",
      );

    this._logging = ComponentFactory.get<ILoggingComponent>(
      options?.loggingComponentType ?? "dataspaceControlPlane",
    );

    this._dataspaceDataPlane =
      ComponentFactory.get<IDataspaceDataPlaneComponent>(
        options?.loggingComponentType ?? "dataspaceControlPlane",
      );
  }

  public async getData(): Promise<unknown> {
    return new Promise<unknown>(async (resolve, reject) => {
      const ids = await ContextIdStore.getContextIds();

      console.log("IDs", ids);

      const negotiationCallbackId = `negotiation-${new Date().toISOString()}`;

      this._dataspaceControlPlane.registerNegotiationCallback(
        negotiationCallbackId,
        {
          onStateChanged: async (
            negotiationId: string,
            state: DataspaceProtocolContractNegotiationStateType,
            data?: {
              offer?: IDataspaceProtocolOffer;
              agreement?: IDataspaceProtocolAgreement;
            },
          ) => {
            await this._logging.log({
              level: LogLevel.Debug,
              message: `Negotiation: ${negotiationId}, Now in state: ${state}`,
              source: this.className(),
            });
          },
          onCompleted: async (negotiationId: string, agreementId: string) => {
            this._dataspaceControlPlane.unregisterNegotiationCallback(
              negotiationCallbackId,
            );

            await this._logging.log({
              level: LogLevel.Debug,
              message: `Negotiation: ${negotiationId} Now Completed. Agreement: ${agreementId}`,
              source: this.className(),
            });

            try {
              // Now we start the Data Transfer
              const transferRequestResult =
                await this._dataspaceControlPlane.requestTransfer(
                  {
                    "@context": [DataspaceProtocolContexts.Context],
                    "@type":
                      DataspaceProtocolTransferProcessTypes.TransferRequestMessage,
                    agreementId: agreementId,
                    consumerPid: `urn:uuid:${randomUUID()}`,
                    callbackAddress:
                      "http://host.docker.internal:3000/dataspace?x-api-key=019e5f84a1657dd88e76e1f158abcda2",

                    format: "twin:Http-Pull-Query-Format",
                  },
                  {},
                );

              if (
                transferRequestResult["@type"] ===
                DataspaceProtocolTransferProcessTypes.TransferError
              ) {
                const transferError =
                  transferRequestResult as IDataspaceProtocolTransferError;
                await this._logging.log({
                  level: LogLevel.Error,
                  message: `Transfer Process Error: reason: ${transferError.reason}`,
                  source: this.className(),
                });
                reject(transferError.reason);
                return;
              }

              const transferResponse =
                transferRequestResult as IDataspaceProtocolTransferProcess;
              await this._logging.log({
                level: LogLevel.Debug,
                message: `Transfer Process created. State: ${transferResponse.state}, Provider Pid: ${transferResponse.providerPid}, Consumer Pid: ${transferResponse.consumerPid}`,
                source: this.className(),
              });

              resolve({});
            } catch (error) {
              reject(error);
            }
          },
          onFailed: async (negotiationId: string, reason: string) => {
            await this._logging.log({
              level: LogLevel.Error,
              source: this.className(),
              message: `Negotiation: ${negotiationId} failed: ${reason}`,
            });
            this._dataspaceControlPlane.unregisterNegotiationCallback(
              negotiationCallbackId,
            );

            reject(`Negotiation: ${negotiationId} failed: ${reason}`);
          },
        },
      );

      const negotiationId =
        await this._dataspaceControlPlane.negotiateAgreement(
          this._DATASET_ID,
          this._OFFER_ID,
          this._PROVIDER_ENDPOINT,
          this._CONSUMER_ENDPOINT,
          {},
        );

      await this._logging.log({
        level: LogLevel.Debug,
        source: this.className(),
        message: `Negotiation started. Id: ${negotiationId}`,
      });
    });
  }

  public async start(nodeLoggingComponentType?: string): Promise<void> {}
}
