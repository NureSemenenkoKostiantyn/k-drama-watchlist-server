import { Schema, type Types } from "mongoose";

import { DiscoveryShelfKey } from "../../../common/types/discovery.types";
import {
  type MediaSummary,
  MediaType,
} from "../../../common/types/media.types";

export interface DiscoveryCacheDocument {
  _id: Types.ObjectId;
  key: DiscoveryShelfKey;
  items: MediaSummary[];
  refreshedAt: Date;
  freshUntil: Date;
  deleteAfter: Date;
  refreshLeaseUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSummarySchema = new Schema<MediaSummary>(
  {
    id: { type: String, required: true },
    tmdbId: { type: Number, required: true },
    mediaType: {
      type: String,
      enum: Object.values(MediaType),
      required: true,
    },
    title: { type: String, required: true },
    originalTitle: { type: String, required: true },
    overview: String,
    posterPath: String,
    posterUrl: String,
    backdropPath: String,
    backdropUrl: String,
    releaseDate: String,
    firstAirDate: String,
    originCountry: { type: [String], default: [] },
    originalLanguage: String,
    genreIds: { type: [Number], default: [] },
    tmdbVoteAverage: Number,
    tmdbVoteCount: Number,
  },
  {
    _id: false,
    versionKey: false,
  },
);

export const DiscoveryCacheSchema = new Schema<DiscoveryCacheDocument>(
  {
    key: {
      type: String,
      enum: Object.values(DiscoveryShelfKey),
      required: true,
    },
    items: {
      type: [mediaSummarySchema],
      required: true,
      default: [],
    },
    refreshedAt: {
      type: Date,
      required: true,
      default: () => new Date(0),
    },
    freshUntil: {
      type: Date,
      required: true,
      default: () => new Date(0),
    },
    deleteAfter: {
      type: Date,
      required: true,
    },
    refreshLeaseUntil: Date,
  },
  {
    collection: "discoveryCache",
    timestamps: true,
    versionKey: false,
  },
);

DiscoveryCacheSchema.index({ key: 1 }, { unique: true });
DiscoveryCacheSchema.index(
  { deleteAfter: 1 },
  { expireAfterSeconds: 0 },
);
