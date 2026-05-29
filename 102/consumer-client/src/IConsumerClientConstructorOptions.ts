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
	dataspaceDataPlaneOfDataProviderComponentType?: string;

	/**
	 * The trust component type.
	 */
	trustComponentType?: string;

	/**
	 * Dataspace Control Plane of provider component type.
	 */
	dataspaceControlPlaneOfDataProviderComponentType?: string;

	/**
	 * Federated Catalogue Component Type
	 */
	federatedCatalogueComponentType?: string;
}
