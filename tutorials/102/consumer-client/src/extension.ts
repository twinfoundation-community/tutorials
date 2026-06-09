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
				config: {}
			},
			restPath: "dataspace-control-plane",
			isDefault: true
		},
		{
			type: DataspaceControlPlaneComponentType.RestClient,
			options: {
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
			options: {
				endpoint: "http://host.docker.internal:3000"
			},
			features: ["remote"],
			isMultiInstance: true
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
						),
						dataspaceDataPlaneOfDataProviderComponentType: engineCore.getRegisteredInstanceType(
							"dataspaceControlPlaneComponent",
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
	const consumerClientRoute: IRestRoute<{ body: unknown }, { body: unknown }> = {
		operationId: "consumerClient",
		summary: "Get Data",
		method: "GET",
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

	return [consumerClientRoute];
}

/**
 * Get data.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @param request.body The body
 * @returns The response object with additional http response properties.
 */
export async function consumerGetData(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: { body: unknown }
): Promise<{ body: unknown }> {
	const component = ComponentFactory.get<IConsumerClientComponent>(componentName);
	const result = await component.getData();

	return {
		body: result
	};
}
