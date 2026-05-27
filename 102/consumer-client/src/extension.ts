// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRoute } from "@twin.org/api-models";
import { Is } from "@twin.org/core";
import { DataspaceAppFactory } from "@twin.org/dataspace-models";
import type {
	EngineTypeInitialiserReturn,
	IEngineCore,
	IEngineCoreConfig,
	IEngineCoreContext,
	IEngineServer
} from "@twin.org/engine-models";
import { type IEngineConfig, EngineTypeHelper } from "@twin.org/engine-types";
import type { IConsumerClientConstructorOptions } from "./IConsumerClientConstructorOptions.js";
import { ConsumerClient } from "./consumerClient.js";

/**
 * Initialise the  extension.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export async function extensionInitialise(
	envVars: { [id: string]: string | unknown },
	nodeEngineConfig: IEngineCoreConfig
): Promise<void> {
	nodeEngineConfig.types.consumerClient = [
		{
			type: "service"
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
 * initializer.
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
	instanceConfig: { type: "service"; options: IConsumerClientConstructorOptions }
): EngineTypeInitialiserReturn<typeof instanceConfig, typeof DataspaceAppFactory> {
	let instanceTypeName: string | undefined;
	let createComponent;

	if (instanceConfig.type === "service") {
		createComponent = (createConfig: typeof instanceConfig) =>
			new ConsumerClient(
				EngineTypeHelper.mergeConfig<IConsumerClientConstructorOptions>(
					{
						loggingComponentType: engineCore.getRegisteredInstanceType("loggingComponent"),
						dataspaceControlPlaneComponentType: engineCore.getRegisteredInstanceType("dataspaceControlPlaneComponent"),
						dataspaceDataPlaneComponentType: engineCore.getRegisteredInstanceType("dataspaceDataPlaneComponent"),
					},
					createConfig.options
				)
			);
		instanceTypeName = "consumerClientComponent";
	}

	return {
		instanceTypeName,
		createComponent
	};
}

/**
 * Generate the rest routes for the component.
 * @param baseRouteName The base route name.
 * @param componentName The component name.
 * @returns The rest routes.
 */
export function generateRestRoutes(baseRouteName: string, componentName: string): IRestRoute[] {
	return [];
}
