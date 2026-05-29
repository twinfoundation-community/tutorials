// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { ILoggingComponent, LogLevel } from "@twin.org/logging-models";
import { IConsumerClientConstructorOptions } from "./IConsumerClientConstructorOptions.js";
import { ComponentFactory, Is } from "@twin.org/core";
import {
	IDataspaceControlPlaneComponent,
	IDataspaceDataPlaneComponent
} from "@twin.org/dataspace-models";
import { IConsumerClientComponent } from "./IConsumerClientComponent.js";
import { ContextIdKeys, ContextIdStore, IContextIds } from "@twin.org/context";
import {
	DataspaceProtocolCatalogTypes,
	DataspaceProtocolContexts,
	DataspaceProtocolContractNegotiationStateType,
	DataspaceProtocolTransferProcessTypes,
	IDataspaceProtocolAgreement,
	IDataspaceProtocolCatalog,
	IDataspaceProtocolDataService,
	IDataspaceProtocolOffer,
	IDataspaceProtocolTransferError,
	IDataspaceProtocolTransferProcess
} from "@twin.org/standards-dataspace-protocol";
import { randomUUID } from "node:crypto";
import { ITrustComponent } from "@twin.org/trust-models";
import { IFederatedCatalogueComponent } from "@twin.org/federated-catalogue-models";

/**
 * Test App Activity Handler.
 */
export class ConsumerClient implements IConsumerClientComponent {
	private _logging: ILoggingComponent;

	private _dataspaceControlPlane: IDataspaceControlPlaneComponent;

	private _providerControlPlane: IDataspaceControlPlaneComponent;
	private _providerDataPlane: IDataspaceDataPlaneComponent;

	private _trustComponent: ITrustComponent;

	private _federatedCatalogue: IFederatedCatalogueComponent;

	public className(): string {
		return "ConsumerClient";
	}

	private _DATASET_ID = "https://twin.example.org/dataset-1342";

	private _PROVIDER_ENDPOINT =
		"http://host.docker.internal:3000/rights-management?x-api-key=019e5ee3ad5f7e94a197735372d895a9";

	private _CONSUMER_ENDPOINT = "http://host.docker.internal:3000";
	/* /rights-management?x-api-key=019e5f84a1657dd88e76e1f158abcda2*/

	private _DATASET_TYPE = "https://vocabulary.uncefact.org/Consignment";

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
	}

	public async getData(): Promise<unknown> {
		return new Promise<unknown>(async (resolve, reject) => {
			try {
				const ids = (await ContextIdStore.getContextIds()) as IContextIds;
				console.log("IDs", ids);

				// Query the federated Catalogue
				const datasets = await this._federatedCatalogue.query([
					{
						"@type": "FilterByExample",
						"dcterms:type": this._DATASET_TYPE
					}
				]);

				const result = datasets.result;
				if (result["@type"] === DataspaceProtocolCatalogTypes.CatalogError) {
					reject(result);
					return;
				}
				const catalog = result as IDataspaceProtocolCatalog;
				if (!Is.arrayValue(catalog.dataset)) {
					reject(`Catalog query did not return any dataset: ${this._DATASET_TYPE}`);
					return;
				}

				const dataset = catalog.dataset[0];
				// Workaround to deal with a Fed  Cat query issue
				const datasetId = dataset["@id"] ?? this._DATASET_ID;
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
				const identity =
					"did:entity-storage:0xf0a778c02c062482b3e4e446f6b441fc5e4853b6f5ebced1f00fc386a1375431";

				// Several workarounds here due to several improvements needed at the DS Protocol implementation side
				const token = await this._trustComponent.generate(
					ids[ContextIdKeys.Node] as string,
					undefined,
					{},
					undefined,
					ids[ContextIdKeys.Node]
				);

				console.log("tttttt", token);

				const negotiationCallbackId = `negotiation-${new Date().toISOString()}`;

				this._dataspaceControlPlane.registerNegotiationCallback(negotiationCallbackId, {
					// Handles on state change CN
					/////////////////////////////
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
					/////////////////////////////
					onCompleted: async (negotiationId: string, agreementId: string) => {
						this._dataspaceControlPlane.unregisterNegotiationCallback(negotiationCallbackId);

						await this._logging.log({
							level: LogLevel.Debug,
							message: `Negotiation: ${negotiationId} Now Completed. Agreement: ${agreementId}`,
							source: this.className()
						});

						try {
							// Now we start the Data Transfer
							const transferRequestResult = await this._providerControlPlane.requestTransfer(
								{
									"@context": [DataspaceProtocolContexts.Context],
									"@type": DataspaceProtocolTransferProcessTypes.TransferRequestMessage,
									agreementId: agreementId,
									consumerPid: `urn:uuid:${randomUUID()}`,
									callbackAddress:
										"http://host.docker.internal:3000/dataspace-control-plane?x-api-key=019e5f84a1657dd88e76e1f158abcda2",

									format: "twin:Http-Pull-Query-Format"
								},
								token
							);

							if (
								transferRequestResult["@type"] ===
								DataspaceProtocolTransferProcessTypes.TransferError
							) {
								const transferError = transferRequestResult as IDataspaceProtocolTransferError;
								await this._logging.log({
									level: LogLevel.Error,
									message: `Transfer Process Error: reason: ${transferError.reason}`,
									source: this.className()
								});
								reject(transferError.reason);
								return;
							}

							const transferResponse = transferRequestResult as IDataspaceProtocolTransferProcess;
							await this._logging.log({
								level: LogLevel.Debug,
								message: `Transfer Process created. State: ${transferResponse.state}, 
                                        Provider Pid: ${transferResponse.providerPid}, Consumer Pid: ${transferResponse.consumerPid}`,
								source: this.className()
							});

							resolve({});
						} catch (error) {
							await this._logging.log({
								level: LogLevel.Error,
								source: this.className(),
								message: `Error while managing negotation completed: ${error}`
							});
							reject(error);
						}
					},
					// Handles on failed CN
					/////////////////////////////
					onFailed: async (negotiationId: string, reason: string) => {
						await this._logging.log({
							level: LogLevel.Error,
							source: this.className(),
							message: `Negotiation: ${negotiationId} failed: ${reason}`
						});
						this._dataspaceControlPlane.unregisterNegotiationCallback(negotiationCallbackId);

						reject(`Negotiation: ${negotiationId} failed: ${reason}`);
					}
				});

				// Everything starts with a Contract Negotiation
				const negotiationId = await this._dataspaceControlPlane.negotiateAgreement(
					datasetId,
					datasetPolicyId,
					this._PROVIDER_ENDPOINT,
					this._CONSUMER_ENDPOINT,
					{}
				);

				await this._logging.log({
					level: LogLevel.Debug,
					source: this.className(),
					message: `Negotiation started. Id: ${negotiationId}`
				});
			} catch (error) {
				await this._logging.log({
					level: LogLevel.Error,
					source: this.className(),
					message: `General Error in the service: ${error}`
				});
				reject(error);
			}
		});
	}

	public async start(nodeLoggingComponentType?: string): Promise<void> {}
}
