// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IHttpRequestContext,
	IRestRoute,
	ITenantAdminComponent,
	IUrlTransformerComponent
} from "@twin.org/api-models";
import { ComponentFactory, GeneralError, Is } from "@twin.org/core";
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
	EngineTypeHelper
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

	nodeEngineConfig.types.dataspaceControlPlaneComponent = [
		{
			type: DataspaceControlPlaneComponentType.Service,
			options: {
				config: {
					dataPlanePath: (envVars.dataspaceDataPlanePath as string) ?? "dataspace/entities"
				}
			},
			restPath: "dataspace-control-plane"
		},
		{
			// PLATFORM-CATCHUP (bug #190): must be isMultiInstance so startDataTransfer's
			// per-call endpoint (carrying ?x-enc-tenant-token=...) is honored. Without it the
			// factory returns a static singleton and drops the token → missingTenantToken.
			// The endpoint here is a placeholder; the real endpoint is supplied per-call.
			type: DataspaceControlPlaneComponentType.RestClient,
			options: {
				endpoint: "http://host.docker.internal:3000"
			},
			isMultiInstance: true,
			features: ["remote"]
		}
	];

	nodeEngineConfig.types.dataspaceDataPlaneComponent = [
		{
			type: DataspaceDataPlaneComponentType.Service,
			options: {
				config: {}
			},
			restPath: "dataspace"
		},
		{
			type: DataspaceDataPlaneComponentType.RestClient,
			options: {
				endpoint: "http://host.docker.internal:3000?x-api-key=019e84e483d07390a3a37052d35f88ef"
			},
			features: ["remote"]
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
							"federatedCatalogueComponent"
						),

						dataspaceControlPlaneOfDataProviderComponentType: engineCore.getRegisteredInstanceType(
							"dataspaceControlPlaneComponent",
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
	// PLATFORM-CATCHUP: dropped `skipAuth: true` from this route. Post api-service
	// #140 ("tenant id in jwt") the TenantProcessor only accepts `?x-api-key=` on
	// `/login`; any other route marked `skipAuth: true` AND missing
	// `x-enc-tenant-token` in the URL is auto-rejected with
	// `tenantProcessor.missingTenantToken`. Removing skipAuth lets the auth chain
	// resolve the tenant from the session JWT's `tid` claim — works on this route
	// because Postman can pass the session cookie / Bearer.
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

	// PLATFORM-CATCHUP: NEW endpoint, tutorial-only scaffolding. Postman is a naked
	// HTTP client and can't reach `urlTransformerComponent.addEncryptedQueryParamToUrl`
	// directly, so it has no way to mint the `x-enc-tenant-token` that PNP /
	// dataspace-control-plane skipAuth routes now require. This helper mints one
	// in-process so the operator can stash it in `prov_tenant_token` /
	// `cons_tenant_token` env vars and use it on C5, C-poll, etc.
	//
	// DO NOT SHIP TO PRODUCTION. In production the provider's catalogue bakes the
	// token into distribution URLs at registration time; nobody outside the
	// platform should ever be able to mint a tenant token for an arbitrary api-key.
	const mintTenantTokenRoute: IRestRoute<
		{ query: { apiKey: string } },
		{ body: { token: string } }
	> = {
		operationId: "mintTenantToken",
		summary:
			"Mint an x-enc-tenant-token for the tenant identified by `apiKey`. Use for hand-driven Postman calls to skipAuth routes (PNP / dataspace-control-plane) where the platform expects the encrypted token, not the api-key.",
		method: "GET",
		tag: "client",
		path: `${baseRouteName}/mint-tenant-token`,
		handler: async (httpRequestContext, request) => {
			const apiKey = request?.query?.apiKey;
			if (!Is.stringValue(apiKey)) {
				throw new GeneralError("consumerClient", "apiKeyQueryParamRequired");
			}
			const tenantAdmin = ComponentFactory.get<ITenantAdminComponent>("tenant-admin-service");
			const urlTransformer =
				ComponentFactory.get<IUrlTransformerComponent>("url-transformer-service");
			const tenant = await tenantAdmin.getByApiKey(apiKey);
			const stamped = await urlTransformer.addEncryptedQueryParamToUrl(
				"http://placeholder/",
				"tenant",
				tenant.id
			);
			const token = new URL(stamped).searchParams.get("x-enc-tenant-token") ?? "";
			return { body: { token } };
		},
		requestType: { type: "unknown", examples: [] },
		responseType: [{ type: "unknown", examples: [] }]
	};

	return [consumerClientRoute, mintTenantTokenRoute];
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
