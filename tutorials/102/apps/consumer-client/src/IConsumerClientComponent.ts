// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IComponent } from "@twin.org/core";

/**
 * Consumer client component
 */
export interface IConsumerClientComponent extends IComponent {
	/**
	 * Get data
	 * @param agreementId agreementId
	 * @param entityType The entity type
	 * @returns unknown
	 */
	getData(agreementId: string, entityType: string): Promise<unknown>;

	/**
	 * Negotiates over a dataset passing id as parameter.
	 * @param entityType The type of entity to negotiate over.
	 * @returns agreement Id
	 */
	negotiate(entityType: string): Promise<string>;
}
