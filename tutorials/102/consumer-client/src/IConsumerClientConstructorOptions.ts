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
	 * Federated Catalogue Component Type
	 */
	federatedCatalogueComponentType?: string;

	/**
	 * Transfer Process Entity Storage Type
	 */
	transferProcessEntityStorageType?: string;

	/**
	 * URL transformer component type.
	 * @default url-transformer-service
	 */
	urlTransformerComponentType?: string;

	/**
	 * Tenant admin component type.
	 * @default tenant-admin-service
	 */
	tenantAdminComponentType?: string;
}
