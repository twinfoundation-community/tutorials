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

/**
 * Test App Activity Handler.
 */
export class ConsumerClient implements IConsumerClientComponent {
  private _logging: ILoggingComponent;

  private _dataspaceControlPlane: IDataspaceControlPlaneComponent;

  private _dataspaceDataPlane: IDataspaceDataPlaneComponent;

  public className(): string { return "ConsumerClient" };

  /**
   * Create a new instance.
   * @param options The constructor options.
   */
  constructor(options?: IConsumerClientConstructorOptions) {
    this._dataspaceControlPlane =
      ComponentFactory.get<IDataspaceControlPlaneComponent>(
        options?.dataspaceControlPlaneComponentType ?? "dataspaceControlPlane",
      );

    this._logging =
      ComponentFactory.get<ILoggingComponent>(
        options?.loggingComponentType ?? "dataspaceControlPlane",
      );

    this._dataspaceDataPlane =
      ComponentFactory.get<IDataspaceDataPlaneComponent>(
        options?.loggingComponentType ?? "dataspaceControlPlane",
      );
  }

  public async getData(): Promise<unknown> {
    return null;
  }

  public async start(nodeLoggingComponentType?: string): Promise<void> {
    
  }
}
