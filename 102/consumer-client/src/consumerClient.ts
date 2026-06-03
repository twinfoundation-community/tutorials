// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/naming-convention */

import { randomUUID } from "node:crypto";
import type { ITenantAdminComponent, IUrlTransformerComponent } from "@twin.org/api-models";
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
	private readonly _DATASET_ID = "https://twin.example.org/dataset-1342";

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

	// PLATFORM-CATCHUP: two new in-process dependencies for the URL transformation
	// dance below. See `_toTenantTokenUrl`.
	private readonly _urlTransformer: IUrlTransformerComponent;

	private readonly _tenantAdmin: ITenantAdminComponent;

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

		// PLATFORM-CATCHUP: factory keys are `url-transformer-service` and
		// `tenant-admin-service` (verified at runtime via ComponentFactory.names());
		// not the `urlTransformerComponent` / `tenantAdminComponent` type-slot names.
		this._urlTransformer = ComponentFactory.get<IUrlTransformerComponent>(
			options?.urlTransformerComponentType ?? "url-transformer-service"
		);

		this._tenantAdmin = ComponentFactory.get<ITenantAdminComponent>(
			options?.tenantAdminComponentType ?? "tenant-admin-service"
		);
	}

	// PLATFORM-CATCHUP: NEW helper. Catalogue distribution URLs in this tutorial
	// are registered with a static `?x-api-key=...` (older platform shape). Post
	// api-service #140 the TenantProcessor only accepts api-key for `/login`, so
	// cross-tenant calls to PNP / data-plane routes need an encrypted tenant
	// token (`x-enc-tenant-token`). Convert the discovered URL by looking up the
	// tenant by its api-key, dropping the api-key param, and baking an encrypted
	// token in its place — same shape a production catalogue would have served
	// originally.
	/**
	 * Transform a catalogue distribution URL from `?x-api-key=...` shape to
	 * `?x-enc-tenant-token=...` shape so post-#140 TenantProcessor will route it.
	 * @param url The provider endpoint URL as discovered from the catalogue.
	 * @returns The transformed URL with `x-enc-tenant-token` and no `x-api-key`.
	 */
	private async _toTenantTokenUrl(url: string): Promise<string> {
		const u = new URL(url);
		const apiKey = u.searchParams.get("x-api-key");
		if (!Is.stringValue(apiKey)) {
			return url;
		}
		const tenant = await this._tenantAdmin.getByApiKey(apiKey);
		u.searchParams.delete("x-api-key");
		return this._urlTransformer.addEncryptedQueryParamToUrl(u.toString(), "tenant", tenant.id);
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
				const catalog = result;
				// PLATFORM-CATCHUP: federated-catalogue response shape now nests
				// datasets under `catalog[0].dataset[]`; the top-level `dataset[]`
				// can be empty. Read both shapes, prefer top-level if present.
				const nestedDatasets = (
					catalog as unknown as { catalog?: Array<{ dataset?: typeof catalog.dataset }> }
				).catalog?.[0]?.dataset;
				const datasetList = Is.arrayValue(catalog.dataset)
					? catalog.dataset
					: Is.arrayValue(nestedDatasets)
						? nestedDatasets
						: undefined;
				if (!Is.arrayValue(datasetList)) {
					reject(new Error(`Catalog query did not return any dataset: ${this._DATASET_TYPE}`));
					return;
				}

				const dataset = datasetList[0];
				// Workaround to deal with a Fed  Cat query issue
				const datasetId = dataset["@id"] ?? this._DATASET_ID;
				const datasetPolicyId = dataset.hasPolicy[0]["@id"];

				const rawProviderEndpoint = (
					dataset.distribution[0].accessService as IDataspaceProtocolDataService
				).endpointURL;
				// PLATFORM-CATCHUP: discovered URL still uses `?x-api-key=...`. Convert
				// to `?x-enc-tenant-token=...` so post-#140 TenantProcessor accepts it
				// at every cross-tenant hop (PNP request/event/verification etc.).
				const providerEndpoint = await this._toTenantTokenUrl(rawProviderEndpoint);
				// PLATFORM-CATCHUP: build the consumer-side callback URL the same
				// way. The previous hardcoded `?x-api-key=...` callback URL was
				// rejected by the provider's TenantProcessor when it pushed back.
				const consumerCallbackAddress = await this._urlTransformer.addEncryptedQueryParamToUrl(
					`${this._CONSUMER_ENDPOINT}/dataspace-control-plane`,
					"tenant",
					ids[ContextIdKeys.Tenant] as string
				);

				await this._logging.log({
					level: LogLevel.Debug,
					message: `DatasetId: ${datasetId}, Policy: ${datasetPolicyId}, Endpoint URL: ${providerEndpoint}`,
					source: this.className()
				});

				// Workaround until we get the organization identity
				const consumerIdentity =
					"did:entity-storage:0xf0a778c02c062482b3e4e446f6b441fc5e4853b6f5ebced1f00fc386a1375431";

				const providerIdentity =
					"did:entity-storage:0x0da317b8a3816ca39bab3dd8e7e6d18656956fbf520f1f270c65bd90f3bc3a1f";

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
					// PLATFORM-CATCHUP: `INegotiationCallback.onCompleted` was renamed
					// to `onFinalized` in dataspace-models PR #147 (commit f62baad) —
					// same semantics, fires when the negotiation reaches FINALIZED.
					// Without this rename the platform's `cb.onFinalized(...)` call
					// hits an undefined method, throws TypeError, gets swallowed by the
					// platform's outer try/catch as "negotiation callback threw during
					// onCompleted", and the transfer step never runs.
					onFinalized: async (negotiationId: string, agreementId: string) => {
						this._dataspaceControlPlane.unregisterNegotiationCallback(negotiationCallbackId);

						await this._logging.log({
							level: LogLevel.Debug,
							message: `Negotiation: ${negotiationId} Now Completed. Agreement: ${agreementId}`,
							source: this.className()
						});

						try {
							const consumerPid = `urn:uuid:${randomUUID()}`;
							// PLATFORM-CATCHUP: `DataspaceTransferFormat.HttpProxyPull`
							// was renamed to `HttpDataPull` in dataspace-models
							// (commit 2c9d424).
							const format = DataspaceTransferFormat.HttpDataPull;

							// PLATFORM-CATCHUP: rather than HTTP-loopback via
							// `_providerControlPlane` (the remote REST client whose URL was
							// bound to `?x-api-key=...` at engine init and still slams
							// into the new x-enc-tenant-token gate), call the local
							// `_dataspaceControlPlane.requestTransfer` under the PROVIDER
							// tenant's context. The transfer-process row lands in the
							// provider's partition just as it would after a real
							// cross-tenant HTTP hop. The api-key in the raw
							// providerEndpoint URL is what we use to look up which tenant.
							const providerApiKey = new URL(rawProviderEndpoint).searchParams.get("x-api-key");
							if (!Is.stringValue(providerApiKey)) {
								throw new Error(
									"Catalogue distribution URL has no x-api-key to identify the provider tenant"
								);
							}
							const providerTenant = await this._tenantAdmin.getByApiKey(providerApiKey);

							const transferRequestResult = await ContextIdStore.run(
								{ ...ids, [ContextIdKeys.Tenant]: providerTenant.id },
								async () =>
									this._dataspaceControlPlane.requestTransfer(
										{
											"@context": [DataspaceProtocolContexts.Context],
											"@type": DataspaceProtocolTransferProcessTypes.TransferRequestMessage,
											agreementId,
											consumerPid,
											callbackAddress: consumerCallbackAddress,
											format
										},
										token
									)
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
				// PLATFORM-CATCHUP: pass `token` (the JWT-VC trust token) as the
				// 5th positional arg. dataspace-control-plane-service #136 added
				// an entry-time `TrustHelper.verifyTrust(trustPayload)` call to
				// `negotiateAgreement`; passing `{}` here used to be harmless on
				// older platforms but now triggers `trustHelper.trustVerifyFailed`
				// with `errors: []` (the verifier's "I don't recognize this as a
				// JWT" signature).
				const negotiationId = await this._dataspaceControlPlane.negotiateAgreement(
					datasetId,
					datasetPolicyId,
					providerEndpoint,
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
