// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { IComponent } from "@twin.org/core";

export interface IConsumerClientComponent extends IComponent {
	getData(): Promise<unknown>;
}
