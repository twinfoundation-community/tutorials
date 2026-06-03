// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/naming-convention */

import { randomUUID } from "node:crypto";
import { ContextIdKeys, ContextIdStore, type IContextIds } from "@twin.org/context";
import { ComponentFactory, Converter, Is, RandomHelper } from "@twin.org/core";
import {
	DataspaceTransferFormat,
	type IDataspaceControlPlaneComponent,
	type IDataspaceDataPlaneComponent,
	type TransferProcess
} from "@twin.org/dataspace-models";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import type { IFederatedCatalogueComponent } from "@twin.org/federated-catalogue-models";
import { type ILoggingComponent, LogLevel } from "@twin.org/logging-models";
import { nameofKebabCase } from "@twin.org/nameof";
import {
	DataspaceProtocolCatalogTypes,
	DataspaceProtocolContexts,
	type DataspaceProtocolContractNegotiationStateType,
	DataspaceProtocolTransferProcessTypes,
	type IDataspaceProtocolAgreement,
	type IDataspaceProtocolDataService,
	type IDataspaceProtocolOffer
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

	private readonly _providerControlPlane: IDataspaceControlPlaneComponent;

	// eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
	private readonly _providerDataPlane: IDataspaceDataPlaneComponent;

	private readonly _trustComponent: ITrustComponent;

	private readonly _federatedCatalogue: IFederatedCatalogueComponent;

	private readonly _transferProcessStorage: IEntityStorageConnector<TransferProcess>;

	/**
	 * Create a new instance.
	 * @param options The constructor options.
	 */
	constructor(options?: IConsumerClientConstructorOptions) {
		console.log(ComponentFactory.names());

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

		this._providerControlPlane = ComponentFactory.get<IDataspaceControlPlaneComponent>(
			options?.dataspaceControlPlaneOfDataProviderComponentType ??
				"dataspaceControlPlaneOfDataProvider"
		);

		this._federatedCatalogue = ComponentFactory.get<IFederatedCatalogueComponent>(
			options?.federatedCatalogueComponentType ?? "federatedCatalogue"
		);

		this._transferProcessStorage = EntityStorageConnectorFactory.get<
			IEntityStorageConnector<TransferProcess>
		>(options?.transferProcessEntityStorageType ?? nameofKebabCase<TransferProcess>());
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
				const consumerIdentity = ids[ContextIdKeys.Organization];

				const providerIdentity =
					"did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f";

				// Several workarounds here due to several improvements needed at the DS Protocol implementation side
				const token = await this._trustComponent.generate(
					ids[ContextIdKeys.Organization] as string,
					undefined,
					{},
					ids[ContextIdKeys.Tenant],
					ids[ContextIdKeys.Organization]
				);

				console.log("tttttt", token);

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
					onCompleted: async (negotiationId: string, agreementId: string) => {
						this._dataspaceControlPlane.unregisterNegotiationCallback(negotiationCallbackId);

						await this._logging.log({
							level: LogLevel.Debug,
							message: `Negotiation: ${negotiationId} Now Completed. Agreement: ${agreementId}`,
							source: this.className()
						});

						try {
							const consumerPid = `urn:uuid:${randomUUID()}`;
							const format = DataspaceTransferFormat.HttpProxyPull;

							// Now we start the Data Transfer
							const transferRequestResult = await this._providerControlPlane.requestTransfer(
								{
									"@context": [DataspaceProtocolContexts.Context],
									"@type": DataspaceProtocolTransferProcessTypes.TransferRequestMessage,
									agreementId,
									consumerPid,
									callbackAddress:
										"http://host.docker.internal:3000/dataspace-control-plane?x-api-key=019e5f84a1657dd88e76e1f158abcda2",

									format
								},
								token
							);

							if (
								transferRequestResult["@type"] ===
								DataspaceProtocolTransferProcessTypes.TransferError
							) {
								await this._logging.log({
									level: LogLevel.Error,
									message: `Transfer Process Error: reason: ${JSON.stringify(transferRequestResult.reason)}`,
									source: this.className()
								});
								reject(transferRequestResult.reason);
								return;
							}

							await this._logging.log({
								level: LogLevel.Debug,
								message: `Transfer Process created. State: ${transferRequestResult.state}, 
                                        Provider Pid: ${transferRequestResult.providerPid}, Consumer Pid: ${transferRequestResult.consumerPid}`,
								source: this.className()
							});

							const transferProcess: TransferProcess = {
								consumerPid,
								providerPid: transferRequestResult.providerPid,
								state: transferRequestResult.state,
								agreementId,
								dateCreated: new Date().toISOString(),
								dateModified: new Date().toISOString(),
								datasetId,
								offerId: datasetPolicyId,
								id: Converter.bytesToHex(RandomHelper.generate(32)),
								providerIdentity,
								format
							};
							await this._transferProcessStorage.set(transferProcess);

							// Call the provider endpoint

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

				// Everything starts with a Contract Negotiation
				const negotiationId = await this._dataspaceControlPlane.negotiateAgreement(
					datasetId,
					datasetPolicyId,
					providerEndpoint,
					this._CONSUMER_ENDPOINT,
					{}
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
