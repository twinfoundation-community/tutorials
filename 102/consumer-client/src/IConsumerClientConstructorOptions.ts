// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Test App Constructor options.
 */
export interface IConsumerClientConstructorOptions {
  /**
   * Logging component type.
   * @default logging
   */
  loggingComponentType?: string;

  /**
   * Dataspace Control Plane component type.
   */
  dataspaceControlPlaneComponentType?: string;

  /**
   * Dataspace Data Plane component type.
   */
  dataspaceDataPlaneComponentType?: string;

  /**
   * The trust component type.
   */
  trustComponentType?: string;
}
