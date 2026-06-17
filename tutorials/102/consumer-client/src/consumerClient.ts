// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/naming-convention */

import { HttpUrlHelper } from "@twin.org/api-models";
import { ContextIdKeys, ContextIdStore, type IContextIds } from "@twin.org/context";
import { ArrayHelper, ComponentFactory, Is } from "@twin.org/core";
import {
	DataspaceTransferFormat,
	type IDataspaceDataPlaneComponent,
	type IDataspaceControlPlaneComponent
} from "@twin.org/dataspace-models";
import { DataspaceDataPlaneComponentType } from "@twin.org/engine-types";
import type { IFederatedCatalogueComponent } from "@twin.org/federated-catalogue-models";
import type { FederatedCatalogueRestClient } from "@twin.org/federated-catalogue-rest-client";
import { type ILoggingComponent, LogLevel } from "@twin.org/logging-models";
import {
	DataspaceProtocolCatalogTypes,
	type IDataspaceProtocolCatalogBase,
	type IDataspaceProtocolDataset,
	type IDataspaceProtocolDatasetBase,
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

	private readonly _DATASET_ENTITY_TYPE = "https://vocabulary.uncefact.org/Consignment";

	private readonly _logging: ILoggingComponent;

	private readonly _dataspaceControlPlane: IDataspaceControlPlaneComponent;

	private readonly _trustComponent: ITrustComponent;

	private readonly _federatedCatalogue: IFederatedCatalogueComponent;

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

		this._trustComponent = ComponentFactory.get<ITrustComponent>(
			options?.trustComponentType ?? "trust"
		);

		this._federatedCatalogue = ComponentFactory.get<IFederatedCatalogueComponent>(
			options?.federatedCatalogueComponentType ?? "federatedCatalogue"
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

				console.log("Before Catalog");

				// The trust token is identity-only and
				// the identity IS the tenant's organization DID from the request context.
				const consumerIdentity = ids[ContextIdKeys.Organization] as string;

				const token = await this._trustComponent.generate(consumerIdentity, undefined, {});

				// Query the federated Catalogue
				const catalogResponse = await (
					this._federatedCatalogue as FederatedCatalogueRestClient
				).query(
					[
						/*
					{
						"@type": "FilterByExample",
						"dcterms:type": this._DATASET_TYPE
					}
					*/
					],
					undefined,
					undefined,
					token
				);

				if (catalogResponse.result["@type"] === DataspaceProtocolCatalogTypes.CatalogError) {
					const catalogError = catalogResponse.result;
					reject(new Error(catalogError.code));
					return;
				}
				console.log(catalogResponse);

				const catalog = catalogResponse.result;
				if (!Is.arrayValue(catalog.catalog) && !Is.arrayValue(catalog.dataset)) {
					reject(
						new Error(`Catalog query did not return any dataset: ${this._DATASET_ENTITY_TYPE}`)
					);
					return;
				}
				let dataset: IDataspaceProtocolDataset | undefined;

				if (Is.arrayValue(catalog.dataset)) {
					dataset = ArrayHelper.fromObjectOrArray<IDataspaceProtocolDatasetBase>(
						catalog.dataset
					)[0] as IDataspaceProtocolDataset;
				}
				if (Is.arrayValue(catalog.catalog)) {
					const catalogItem = ArrayHelper.fromObjectOrArray<IDataspaceProtocolCatalogBase>(
						catalog.catalog
					)[0];
					if (!Is.arrayValue(catalogItem.dataset)) {
						reject(
							new Error(`Catalog query did not return any dataset: ${this._DATASET_ENTITY_TYPE}`)
						);
						return;
					}
					dataset = catalogItem.dataset[0] as IDataspaceProtocolDataset;
				}

				if (Is.undefined(dataset)) {
					reject(
						new Error(`Catalog query did not return any dataset: ${this._DATASET_ENTITY_TYPE}`)
					);
					return;
				}

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

				const providerIdentity =
					"did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f";

				console.log("After Catalog");

				console.log("Token", token);

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
										message: `TransferProcess: ${consumerPid} Now started: channel: ${message.dataAddress?.endpoint}`,
										source: this.className()
									});
									// Retrieve the data
									const endpoint = message.dataAddress?.endpoint;
									if (Is.undefined(endpoint)) {
										reject(
											new Error(`No data address supplied for transfer process ${consumerPid}`)
										);
										return;
									}
									const dataProviderDataPlane =
										ComponentFactory.create<IDataspaceDataPlaneComponent>(
											DataspaceDataPlaneComponentType.RestClient,
											{
												endpoint
											}
										);
									const entities = await dataProviderDataPlane.getDataAssetEntities(
										{
											entityType: this._DATASET_ENTITY_TYPE
										},
										consumerPid,
										undefined,
										undefined,
										token
									);

									resolve(entities);
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

							// Callbacks route by the cleartext org DID, not an
							// encrypted tenant token.
							const consumerTransferCallback = HttpUrlHelper.addQueryStringParam(
								`${this._CONSUMER_ENDPOINT}/dataspace-control-plane`,
								ContextIdKeys.Organization,
								consumerIdentity
							);

							const transferResult = await this._dataspaceControlPlane.prepareTransfer(
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

				const negotiationProviderEndpoint = new URL(providerEndpoint);
				negotiationProviderEndpoint.pathname += "rights-management";

				// Everything starts with a Contract Negotiation
				const negotiationId = await this._dataspaceControlPlane.negotiateAgreement(
					datasetId,
					datasetPolicyId,
					negotiationProviderEndpoint.toString(),
					this._CONSUMER_ENDPOINT,
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
