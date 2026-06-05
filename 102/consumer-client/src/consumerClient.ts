// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/naming-convention */

import type { ITenantAdminComponent, IUrlTransformerComponent } from "@twin.org/api-models";
import { ContextIdKeys, ContextIdStore, type IContextIds } from "@twin.org/context";
import { ComponentFactory, Is } from "@twin.org/core";
import {
	DataspaceTransferFormat,
	type IDataspaceControlPlaneComponent
} from "@twin.org/dataspace-models";
import type { IFederatedCatalogueComponent } from "@twin.org/federated-catalogue-models";
import { type ILoggingComponent, LogLevel } from "@twin.org/logging-models";
import {
	DataspaceProtocolCatalogTypes,
	type DataspaceProtocolContractNegotiationStateType,
	type IDataspaceProtocolAgreement,
	type IDataspaceProtocolDataService,
	type IDataspaceProtocolOffer
} from "@twin.org/standards-dataspace-protocol";
import { TrustHelper, type ITrustComponent } from "@twin.org/trust-models";
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

	private readonly _trustComponent: ITrustComponent;

	private readonly _federatedCatalogue: IFederatedCatalogueComponent;

	// PLATFORM-CATCHUP: two new in-process dependencies for the URL transformation
	// dance below. See `_toTenantTokenUrl`.
	private readonly _urlTransformer: IUrlTransformerComponent;

	private readonly _tenantAdmin: ITenantAdminComponent;

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

	public className(): string {
		return "ConsumerClient";
	}

	public async getData(): Promise<unknown> {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise<unknown>(async (resolve, reject) => {
			try {
				const ids = (await ContextIdStore.getContextIds()) as IContextIds;

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
					catalog as unknown as { catalog?: { dataset?: typeof catalog.dataset }[] }
				).catalog?.[0]?.dataset;
				let datasetList: typeof catalog.dataset | undefined;
				if (Is.arrayValue(catalog.dataset)) {
					datasetList = catalog.dataset;
				} else if (Is.arrayValue(nestedDatasets)) {
					datasetList = nestedDatasets;
				}
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
				// This is the NEGOTIATION endpoint (rights-management path).
				const providerEndpoint = await this._toTenantTokenUrl(rawProviderEndpoint);

				// The TRANSFER endpoint is the provider's dataspace-control-plane on the same
				// host. startDataTransfer passes pathPrefix:"" to the REST client, so the
				// endpoint must already carry the correct base path. Derive it from the
				// catalogue host (the distribution URL points at the rights-management
				// negotiation path) and bake the same encrypted tenant token.
				const transferEndpointUrl = new URL(rawProviderEndpoint);
				transferEndpointUrl.pathname = "/dataspace-control-plane";
				const providerControlPlaneEndpoint = await this._toTenantTokenUrl(
					transferEndpointUrl.toString()
				);

				await this._logging.log({
					level: LogLevel.Debug,
					message: `DatasetId: ${datasetId}, Policy: ${datasetPolicyId}, Endpoint URL: ${providerEndpoint}`,
					source: this.className()
				});

				// PLATFORM-CATCHUP: the trust token must carry the consumer's tenant hash as
				// the `tid` claim. The provider captures this during negotiation and stamps
				// the agreement assignee as the consumer composite `nodeDid:hash(tenantId)`;
				// the transfer side rebuilds the caller composite from the same `tid`. Passing
				// `undefined` yields a bare-DID assignee that can't match a tenant-scoped
				// caller (`callerNotAuthorizedForAgreement`). Hash the tenant id the same way
				// the platform does (TrustHelper.hashTenantId).
				const token = await this._trustComponent.generate(
					ids[ContextIdKeys.Node] as string,
					undefined,
					{},
					TrustHelper.hashTenantId(ids[ContextIdKeys.Tenant]),
					ids[ContextIdKeys.Organization]
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
							// PLATFORM-CATCHUP: `DataspaceTransferFormat.HttpProxyPull`
							// was renamed to `HttpDataPull` in dataspace-models
							// (commit 2c9d424).
							const format = DataspaceTransferFormat.HttpDataPull;

							// Use the dataspace control plane convenience method to start the
							// transfer. It resolves the agreement from the consumer PAP (requires
							// the bug #175 fix that writes the agreement to the consumer PAP on
							// finalize), builds the TransferRequestMessage, dispatches it to the
							// provider at `providerEndpoint` (which carries ?x-enc-tenant-token=...),
							// and persists the consumer-side transfer-process. The endpoint token is
							// only honored because the dataspace control plane REST client is
							// registered isMultiInstance (bug #190 fix).
							const transferResult = await this._dataspaceControlPlane.startDataTransfer(
								agreementId,
								providerControlPlaneEndpoint,
								this._CONSUMER_ENDPOINT,
								format,
								token
							);

							await this._logging.log({
								level: LogLevel.Debug,
								message: `Transfer started. Consumer Pid: ${transferResult.consumerPid}`,
								source: this.className()
							});

							resolve(transferResult);
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
}
