import { Inject, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import { type HydratedDocument, type Model } from "mongoose";

import { type DiscoveryShelfKey } from "../../common/types/discovery.types";
import { type MediaSummary } from "../../common/types/media.types";
import { DISCOVERY_CACHE_MODEL } from "./discovery-cache-model.provider";
import { type DiscoveryCacheDocument } from "./schema/discovery-cache.schema";

export interface StoredDiscoveryCache {
  key: DiscoveryShelfKey;
  items: MediaSummary[];
  refreshedAt: Date;
  freshUntil: Date;
  deleteAfter: Date;
  refreshLeaseUntil?: Date;
}

export interface StoreDiscoveryCacheInput {
  items: MediaSummary[];
  refreshedAt: Date;
  freshUntil: Date;
  deleteAfter: Date;
}

@Injectable()
export class DiscoveryCacheRepository {
  constructor(
    @Inject(DISCOVERY_CACHE_MODEL)
    private readonly cacheModel: Model<DiscoveryCacheDocument>,
  ) {}

  async findByKey(
    key: DiscoveryShelfKey,
  ): Promise<StoredDiscoveryCache | null> {
    const document = await this.cacheModel.findOne({ key }).exec();
    return document ? mapCacheDocument(document) : null;
  }

  async tryAcquireRefreshLease(
    key: DiscoveryShelfKey,
    now: Date,
    leaseUntil: Date,
    deleteAfter: Date,
  ): Promise<boolean> {
    try {
      const document = await this.cacheModel
        .findOneAndUpdate(
          {
            key,
            $or: [
              { refreshLeaseUntil: { $exists: false } },
              { refreshLeaseUntil: { $lte: now } },
            ],
          },
          {
            $set: { refreshLeaseUntil: leaseUntil },
            $setOnInsert: {
              items: [],
              refreshedAt: new Date(0),
              freshUntil: new Date(0),
              deleteAfter,
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        )
        .exec();
      return document !== null;
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        return false;
      }

      throw error;
    }
  }

  async store(
    key: DiscoveryShelfKey,
    input: StoreDiscoveryCacheInput,
  ): Promise<void> {
    await this.cacheModel
      .updateOne(
        { key },
        {
          $set: input,
          $unset: { refreshLeaseUntil: 1 },
        },
        {
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();
  }

  async releaseRefreshLease(key: DiscoveryShelfKey): Promise<void> {
    await this.cacheModel
      .updateOne(
        { key },
        { $unset: { refreshLeaseUntil: 1 } },
      )
      .exec();
  }
}

function mapCacheDocument(
  document: HydratedDocument<DiscoveryCacheDocument>,
): StoredDiscoveryCache {
  const value = document.toObject<DiscoveryCacheDocument>();
  return {
    key: value.key,
    items: value.items,
    refreshedAt: value.refreshedAt,
    freshUntil: value.freshUntil,
    deleteAfter: value.deleteAfter,
    ...(value.refreshLeaseUntil === undefined
      ? {}
      : { refreshLeaseUntil: value.refreshLeaseUntil }),
  };
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
