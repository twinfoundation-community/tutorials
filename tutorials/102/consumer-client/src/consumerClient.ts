// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/naming-convention */

import type { IUrlTransformerComponent } from "@twin.org/api-models";
import { ContextIdKeys, ContextIdStore, type IContextIds } from "@twin.org/context";
import { ComponentFactory, Is } from "@twin.org/core";
import {
	DataspaceTransferFormat,
	type IDataspaceControlPlaneComponent,
	type IDataspaceDataPlaneComponent
} from "@twin.org/dataspace-models";
import type { IFederatedCatalogueComponent } from "@twin.org/federated-catalogue-models";
import { type ILoggingComponent, LogLevel } from "@twin.org/logging-models";
import {
	DataspaceProtocolCatalogTypes,
	type DataspaceProtocolContractNegotiationStateType,
	type DataspaceProtocolTransferProcessStateType,
	type IDataspaceProtocolAgreement,
	type IDataspaceProtocolDataService,
	type IDataspaceProtocolOffer,
	type IDataspaceProtocolTransferStartMessage
} from "@twin.org/standards-dataspace-protocol";
import type { ITrustComponent } from "@twin.org/trust-models";
import type { IConsumerClientComponent } from "./IConsumerClientComponent.js";
import type { IConsumerClientConstructorOptions } from "./IConsumerClientConstructorOptions.js";

/**
 * Test App Activity Handler.
 */
export class ConsumerClient implements IConsumerClientComponent {
	private readonly _CONSUMER_ENDPOINT = "http://host.docker.internal:3000";
	/* /rights-management?x-api-key=019e5f84a1657dd88e76e1f158abcda2*/

	private readonly _DATASET_TYPE = "https://vocabulary.uncefact.org/Consignment";

	private readonly _logging: ILoggingComponent;

	private readonly _dataspaceControlPlane: IDataspaceControlPlaneComponent;

	// eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
	private readonly _providerDataPlane: IDataspaceDataPlaneComponent;

	private readonly _trustComponent: ITrustComponent;

	private readonly _federatedCatalogue: IFederatedCatalogueComponent;

	private readonly _urlTransformer: IUrlTransformerComponent;

	/**
	 * Create a new instance.
	 * @param options The constructor options.
	 */
	constructor(options?: IConsumerClientConstructorOptions) {
		this._dataspaceControlPlane = ComponentFactory.get<IDataspaceControlPlaneComponent>(
			options?.dataspaceControlPlaneComponentType ?? "dataspaceControlPlane"
		);

		this._logging = ComponentFactory.get<ILoggingComponent>(
			options?.loggingComponentType ?? "dataspaceControlPlane"
		);

		this._providerDataPlane = ComponentFactory.get<IDataspaceDataPlaneComponent>(
			options?.dataspaceControlPlaneOfDataProviderComponentType ?? "dataspaceDataPlane"
		);

		this._trustComponent = ComponentFactory.get<ITrustComponent>(
			options?.trustComponentType ?? "trust"
		);

		this._federatedCatalogue = ComponentFactory.get<IFederatedCatalogueComponent>(
			options?.federatedCatalogueComponentType ?? "federatedCatalogue"
		);

		this._urlTransformer = ComponentFactory.get<IUrlTransformerComponent>(
			options?.urlTransformerComponentType ?? "url-transformer-service"
		);
	}

	public className(): string {
		return "ConsumerClient";
	}

	public async getData(): Promise<unknown> {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise<unknown>(async (resolve, reject) => {
			try {
				const ids = (await ContextIdStore.getContextIds()) as IContextIds;
				console.log("IDs", ids);

				// Query the federated Catalogue
				const datasets = await this._federatedCatalogue.query([
					/*
					{
						"@type": "FilterByExample",
						"dcterms:type": this._DATASET_TYPE
					}
					*/
				]);

				const result = datasets.result;
				if (result["@type"] === DataspaceProtocolCatalogTypes.CatalogError) {
					reject(result);
					return;
				}
				const catalog = result;
				if (!Is.arrayValue(catalog.catalog)) {
					reject(new Error(`Catalog query did not return any dataset: ${this._DATASET_TYPE}`));
					return;
				}
				if (!Is.arrayValue(catalog.catalog[0].dataset)) {
					reject(new Error(`Catalog query did not return any dataset: ${this._DATASET_TYPE}`));
					return;
				}

				const dataset = catalog.catalog[0].dataset[0];
				const datasetId = dataset["@id"];
				const datasetPolicyId = dataset.hasPolicy[0]["@id"];

				const providerEndpoint = (
					dataset.distribution[0].accessService as IDataspaceProtocolDataService
				).endpointURL;

				await this._logging.log({
					level: LogLevel.Debug,
					message: `DatasetId: ${datasetId}, Policy: ${datasetPolicyId}, Endpoint URL: ${providerEndpoint}`,
					source: this.className()
				});

				// Workaround until we get the organization identity
				const consumerIdentity = ids[ContextIdKeys.Organization] as string;

				const providerIdentity =
					"did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f";

				// Several workarounds here due to several improvements needed at the DS Protocol implementation side
				const token = await this._trustComponent.generate(
					consumerIdentity,
					undefined,
					{},
					ids[ContextIdKeys.Tenant],
					consumerIdentity
				);

				const negotiationCallbackId = `negotiation-${new Date().toISOString()}`;

				this._dataspaceControlPlane.registerNegotiationCallback(negotiationCallbackId, {
					// Handles on state change CN
					// ///////////////////////////
					onStateChanged: async (
						negotiationId: string,
						state: DataspaceProtocolContractNegotiationStateType,
						data?: {
							offer?: IDataspaceProtocolOffer;
							agreement?: IDataspaceProtocolAgreement;
						}
					) => {
						await this._logging.log({
							level: LogLevel.Debug,
							message: `Negotiation: ${negotiationId}, Now in state: ${state}`,
							source: this.className()
						});
					},
					// Handles on completed CN
					// ///////////////////////////
					onFinalized: async (negotiationId: string, agreementId: string) => {
						this._dataspaceControlPlane.unregisterNegotiationCallback(negotiationCallbackId);

						await this._logging.log({
							level: LogLevel.Debug,
							message: `Negotiation: ${negotiationId} Now Completed. Agreement: ${agreementId}`,
							source: this.className()
						});

						try {
							const format = DataspaceTransferFormat.HttpDataPull;

							const transferCallbackId = `transfer-${new Date().toISOString()}`;
							this._dataspaceControlPlane.registerTransferCallback(transferCallbackId, {
								onStarted: async (
									consumerPid: string,
									message: IDataspaceProtocolTransferStartMessage
								) => {
									await this._logging.log({
										level: LogLevel.Debug,
										message: `TransferProcess: ${consumerPid} Now started`,
										source: this.className()
									});
									// Retrieve the data
								},
								onStateChanged: async (
									consumerPid: string,
									state: DataspaceProtocolTransferProcessStateType
								) => {
									await this._logging.log({
										level: LogLevel.Debug,
										message: `TransferProcess: ${consumerPid} Now in state: ${state}`,
										source: this.className()
									});
								},

								onCompleted: async (consumerPid: string) => {},

								onSuspended: async (consumerPid: string, reason?: string) => {},

								onTerminated: async (consumerPid: string, reason?: string) => {}
							});

							const providerEndpointTransfer = new URL(providerEndpoint);
							providerEndpointTransfer.pathname += "dataspace-control-plane";
							const consumerTransferCallback =
								await this._urlTransformer.addEncryptedQueryParamToUrl(
									`${this._CONSUMER_ENDPOINT}/dataspace-control-plane`,
									"tenant",
									ids[ContextIdKeys.Tenant] as string
								);
							const transferResult = await this._dataspaceControlPlane.startDataTransfer(
								agreementId,
								providerEndpointTransfer.toString(),
								consumerTransferCallback,
								format,
								token
							);

							await this._logging.log({
								level: LogLevel.Debug,
								source: this.className(),
								message: `Transfer Process Initiated. Consumer Pid: ${transferResult.consumerPid}`
							});

							resolve({});
						} catch (error) {
							await this._logging.log({
								level: LogLevel.Error,
								source: this.className(),
								message: `Error while managing negotation completed: ${JSON.stringify(error)}`
							});
							reject(error);
						}
					},
					// Handles on failed CN
					// ///////////////////////////
					onFailed: async (negotiationId: string, reason: string) => {
						await this._logging.log({
							level: LogLevel.Error,
							source: this.className(),
							message: `Negotiation: ${negotiationId} failed: ${reason}`
						});
						this._dataspaceControlPlane.unregisterNegotiationCallback(negotiationCallbackId);

						reject(new Error(`Negotiation: ${negotiationId} failed: ${reason}`));
					}
				});

				const consumerCallbackAddress = await this._urlTransformer.addEncryptedQueryParamToUrl(
					`${this._CONSUMER_ENDPOINT}/rights-management`,
					"tenant",
					ids[ContextIdKeys.Tenant] as string
				);

				const negotiationProviderEndpoint = new URL(providerEndpoint);
				negotiationProviderEndpoint.pathname += "rights-management";

				// Everything starts with a Contract Negotiation
				const negotiationId = await this._dataspaceControlPlane.negotiateAgreement(
					datasetId,
					datasetPolicyId,
					negotiationProviderEndpoint.toString(),
					consumerCallbackAddress,
					token
				);

				await this._logging.log({
					level: LogLevel.Debug,
					source: this.className(),
					message: `Negotiation started. Id: ${negotiationId.negotiationId}`
				});
			} catch (error) {
				await this._logging.log({
					level: LogLevel.Error,
					source: this.className(),
					message: `General Error in the service: ${JSON.stringify(error)}`
				});
				reject(error);
			}
		});
	}

	/**
	 * Start method.
	 * @param nodeLoggingComponentType Node Logging Component
	 */
	public async start(nodeLoggingComponentType?: string): Promise<void> {}
}
