// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IHttpRequestContext, IRestRoute } from "@twin.org/api-models";
import { ComponentFactory } from "@twin.org/core";
import type {
	EngineTypeInitialiserReturn,
	IEngineCore,
	IEngineCoreConfig,
	IEngineCoreContext,
	IEngineServer
} from "@twin.org/engine-models";
import {
	type IEngineConfig,
	DataspaceControlPlaneComponentType,
	DataspaceDataPlaneComponentType,
	EngineTypeHelper,
	FederatedCatalogueComponentType
} from "@twin.org/engine-types";
import { ConsumerClient } from "./consumerClient.js";
import type { IConsumerClientComponent } from "./IConsumerClientComponent.js";
import type { IConsumerClientConstructorOptions } from "./IConsumerClientConstructorOptions.js";

/**
 * Initialise the  extension.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export async function extensionInitialise(
	envVars: { [id: string]: string | unknown },
	nodeEngineConfig: IEngineCoreConfig
): Promise<void> {
	nodeEngineConfig.types.consumerClientComponent = [
		{
			type: "service",
			options: {
				config: {}
			},
			restPath: "consumer-client"
		}
	];

	// Tutorial 102 is a SINGLE node: provider and consumer are tenants on the same node,
	// so the federated catalogue is local. The in-process Service is the default; the
	// remote RestClient is kept only as a non-default option (the two-node Frontiers case
	// points it at the provider container, e.g. http://dpi.provider:3000).
	nodeEngineConfig.types.federatedCatalogueComponent = [
		{
			type: FederatedCatalogueComponentType.Service,
			restPath: "federated-catalogue",
			isDefault: true
		},
		{
			type: FederatedCatalogueComponentType.RestClient,
			options: {
				endpoint: "http://host.docker.internal:3000"
			},
			features: ["remote"]
		}
	];

	nodeEngineConfig.types.dataspaceControlPlaneComponent = [
		{
			type: DataspaceControlPlaneComponentType.Service,
			options: {
				config: {
					// This override REPLACES the env-built control-plane config, so the data
					// plane path must be forwarded or pull transfers fail at startTransfer
					// with "pullTransfersNotSupported".
					// eslint-disable-next-line no-restricted-syntax -- tutorial extension reads node env directly
					dataPlanePath: process.env.TWIN_DATASPACE_DATA_PLANE_PATH ?? "dataspace/entities",
					// The automated consumer-client getData() waits for the transfer to reach
					// STARTED, so on single-node 102 the provider must auto-start it on request
					// (the default). The manual Postman/curl DSP walkthrough instead drives the
					// provider start step itself (transfer ".../start"), which needs auto-start
					// OFF so that start returns the data address synchronously. Flip it per flow
					// with TWIN_DATASPACE_AUTO_START_TRANSFERS=false plus a node restart.
					// eslint-disable-next-line no-restricted-syntax -- tutorial extension reads node env directly
					autoStartTransfers: process.env.TWIN_DATASPACE_AUTO_START_TRANSFERS !== "false"
				}
			},
			restPath: "dataspace-control-plane",
			isDefault: true
		},
		{
			type: DataspaceControlPlaneComponentType.RestClient,
			options: {
				// Default remote control-plane endpoint. Per-call the consumer overrides this
				// with the providerEndpoint resolved from the catalogue. Single-node: same node.
				endpoint: "http://host.docker.internal:3000"
			},
			features: ["remote"],
			isMultiInstance: true
		}
	];

	nodeEngineConfig.types.dataspaceDataPlaneComponent = [
		{
			type: DataspaceDataPlaneComponentType.Service,
			options: {
				config: {}
			},
			restPath: "dataspace",
			isDefault: true
		},
		{
			type: DataspaceDataPlaneComponentType.RestClient,
			features: ["remote"],
			isMultiInstance: true
		}
	];

	// When the consumer initiates a contract negotiation, the PNP
	// (sendRequestToProvider) builds a trust token whose credentialSubject is the
	// policy data returned by the Policy Information Point. With no PIP source the
	// PIP returns {} and the VC generator (info?.subject ?? {id}) keeps that empty
	// object, so verifiableCredentialCreate fails with guard.objectValue on an empty
	// subject. A static public source gives the consumer a non-empty subject so the
	// negotiation trust token can be minted. (The empty-policyData -> empty-subject
	// path is a platform robustness gap; this static source is the supported
	// config-level workaround.)
	nodeEngineConfig.types.rightsManagementPolicyInformationSourceComponent = [
		{
			type: "static",
			options: {
				config: {
					information: [
						{
							accessMode: "public",
							objects: {
								"urn:dpi:consumer-profile": {
									"@context": "https://schema.org",
									"@type": "Organization"
									// purpose: "data-consumption"
								}
							}
						}
					]
				}
			}
		}
	];
}

/**
 * Initialise the engine for the extension.
 * @param engineCore The engine core instance.
 */
export async function extensionInitialiseEngine(engineCore: IEngineCore): Promise<void> {
	engineCore.addTypeInitialiser(
		"consumerClientComponent",
		"@twin-community.org/consumer-client",
		"consumerClientInitialiser"
	);
}

/**
 * Initialise the engine server for the extension.
 * @param engineCore The engine core instance.
 * @param engineServer The engine server instance.
 */
export async function extensionInitialiseEngineServer(
	engineCore: IEngineCore,
	engineServer: IEngineServer
): Promise<void> {
	engineServer.addRestRouteGenerator(
		"consumerClientComponent",
		"@twin-community.org/consumer-client",
		"generateRestRoutes"
	);
}

/**
 * Initializer Component.
 * @param engineCore The engine core.
 * @param context The context for the engine.
 * @param instanceConfig The instance config.
 * @param instanceConfig.options The instance config options.
 * @param instanceConfig.type The instance type.
 * @returns The instance created and the factory for it.
 */
export function consumerClientInitialiser(
	engineCore: IEngineCore<IEngineConfig>,
	context: IEngineCoreContext,
	instanceConfig: {
		type: "service";
		options: IConsumerClientConstructorOptions;
	}
): EngineTypeInitialiserReturn<typeof instanceConfig, typeof ComponentFactory> {
	let instanceTypeName: string | undefined;
	let createComponent;

	if (instanceConfig.type === "service") {
		createComponent = (createConfig: typeof instanceConfig) =>
			new ConsumerClient(
				EngineTypeHelper.mergeConfig<IConsumerClientConstructorOptions>(
					{
						loggingComponentType: engineCore.getRegisteredInstanceType("loggingComponent"),

						dataspaceControlPlaneComponentType: engineCore.getRegisteredInstanceType(
							"dataspaceControlPlaneComponent"
						),

						trustComponentType: engineCore.getRegisteredInstanceType("trustComponent"),

						federatedCatalogueComponentType: engineCore.getRegisteredInstanceType(
							"federatedCatalogueComponent",
							["remote"]
						)
					},
					createConfig.options
				)
			);
		instanceTypeName = "consumerClientComponent";
	}

	return {
		createComponent,
		instanceTypeName,
		factory: ComponentFactory
	};
}

/**
 * Generate the rest routes for the component.
 * @param baseRouteName The base route name.
 * @param componentName The component name.
 * @returns The rest routes.
 */
export function generateRestRoutes(baseRouteName: string, componentName: string): IRestRoute[] {
	const consumerClientRoute: IRestRoute<
		{ body: { agreementId: string; entityType: string } },
		{ body: unknown }
	> = {
		operationId: "consumerClient",
		summary: "Get Data",
		method: "POST",
		tag: "client",
		path: `${baseRouteName}/query-data`,
		handler: async (httpRequestContext, request) =>
			consumerGetData(httpRequestContext, componentName, request),
		requestType: {
			type: "unknown",
			examples: []
		},
		responseType: [
			{
				type: "unknown",
				examples: []
			}
		]
	};

	const negotiateRoute: IRestRoute<
		{ body: { datasetId: string } },
		{ body: { agreementId: string } }
	> = {
		operationId: "negotiate",
		summary: "Negotiate Data",
		method: "POST",
		tag: "negotiation",
		path: `${baseRouteName}/negotiate`,
		handler: async (httpRequestContext, request) =>
			negotiate(httpRequestContext, componentName, request),
		requestType: {
			type: "unknown",
			examples: []
		},
		responseType: [
			{
				type: "unknown",
				examples: []
			}
		]
	};

	return [consumerClientRoute, negotiateRoute];
}

/**
 * Get data.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @param request.body The body
 * @param request.body.datasetId The datasetId
 * @returns The response object with additional http response properties.
 */
export async function negotiate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: { body: { datasetId: string } }
): Promise<{ body: { agreementId: string } }> {
	const component = ComponentFactory.get<IConsumerClientComponent>(componentName);
	const result = await component.negotiate(request.body.datasetId);

	return {
		body: {
			agreementId: result
		}
	};
}

/**
 * Get data.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @param request.body The body string params.
 * @param request.body.agreementId The agreement id to fetch data for.
 * @param request.body.entityType The type of entity associated with the agreementId.
 * @returns The response object with additional http response properties.
 */
export async function consumerGetData(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: { body: { agreementId: string; entityType: string } }
): Promise<{ body: unknown }> {
	const component = ComponentFactory.get<IConsumerClientComponent>(componentName);
	const result = await component.getData(request.body.agreementId, request.body.entityType);

	return {
		body: result
	};
}
