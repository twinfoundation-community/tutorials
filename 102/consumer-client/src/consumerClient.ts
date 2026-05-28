// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { ILoggingComponent } from "@twin.org/logging-models";
import { IConsumerClientConstructorOptions } from "./IConsumerClientConstructorOptions.js";
import { IComponent, ComponentFactory } from "@twin.org/core";
import {
  IDataspaceControlPlaneComponent,
  IDataspaceDataPlaneComponent,
} from "@twin.org/dataspace-models";
import { IConsumerClientComponent } from "./IConsumerClientComponent.js";
import { NegotiationHandler } from "./negotiationHandler.js";

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
    "http://host.docker.internal:3000?x-api-key=019e5ee3ad5f7e94a197735372d895a9";

  private _CONSUMER_ENDPOINT =
    "http://host.docker.internal:3000?x-api-key=019e5f84a1657dd88e76e1f158abcda2";

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
    this._dataspaceControlPlane.registerNegotiationCallback(
      `negotiation-${new Date().toISOString()}`,
      new NegotiationHandler(),
    );

    const negotiationId = await this._dataspaceControlPlane.negotiateAgreement(
      this._DATASET_ID,
      this._OFFER_ID,
      this._PROVIDER_ENDPOINT,
      this._CONSUMER_ENDPOINT,
      {},
    );

    console.log("Negotiation ID", negotiationId);

    return {};
  }

  public async start(nodeLoggingComponentType?: string): Promise<void> {}
}
