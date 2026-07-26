import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type DiscoveryCacheDocument,
  DiscoveryCacheSchema,
} from "./schema/discovery-cache.schema";

export const DISCOVERY_CACHE_MODEL_NAME = "DiscoveryCache";
export const DISCOVERY_CACHE_MODEL = Symbol("DISCOVERY_CACHE_MODEL");

export const discoveryCacheModelProvider: Provider<
  Model<DiscoveryCacheDocument>
> = {
  provide: DISCOVERY_CACHE_MODEL,
  inject: [getConnectionToken()],
  useFactory: (
    connection: Connection,
  ): Model<DiscoveryCacheDocument> =>
    connection.model<DiscoveryCacheDocument>(
      DISCOVERY_CACHE_MODEL_NAME,
      DiscoveryCacheSchema,
    ),
};
