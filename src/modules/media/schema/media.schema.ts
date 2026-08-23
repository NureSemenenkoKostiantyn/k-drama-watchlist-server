import { Schema, type Types } from "mongoose";

import {
  MediaReleaseStatus,
  MediaType,
} from "../../../common/types/media.types";

export interface MediaSeasonDocument {
  tmdbSeasonId?: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
}

export interface MediaDocument {
  _id: Types.ObjectId;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview?: string;
  posterPath?: string;
  posterUrl?: string;
  backdropPath?: string;
  backdropUrl?: string;
  releaseDate?: string;
  firstAirDate?: string;
  originCountry: string[];
  originalLanguage?: string;
  genreIds: number[];
  runtimeMinutes?: number;
  totalEpisodes?: number;
  totalSeasons?: number;
  releaseStatus?: MediaReleaseStatus;
  seasons?: MediaSeasonDocument[];
  tmdbVoteAverage?: number;
  tmdbVoteCount?: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSeasonSchema = new Schema<MediaSeasonDocument>(
  {
    tmdbSeasonId: Number,
    seasonNumber: { type: Number, required: true },
    name: { type: String, required: true },
    episodeCount: { type: Number, required: true },
    airDate: String,
    posterPath: String,
  },
  {
    _id: false,
  },
);

export const MediaSchema = new Schema<MediaDocument>(
  {
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
    runtimeMinutes: Number,
    totalEpisodes: Number,
    totalSeasons: Number,
    releaseStatus: {
      type: String,
      enum: Object.values(MediaReleaseStatus),
    },
    seasons: {
      type: [mediaSeasonSchema],
      default: undefined,
    },
    tmdbVoteAverage: Number,
    tmdbVoteCount: Number,
    lastSyncedAt: { type: Date, required: true },
  },
  {
    collection: "media",
    timestamps: true,
    versionKey: false,
  },
);

MediaSchema.index({ mediaType: 1, tmdbId: 1 }, { unique: true });
MediaSchema.index({ title: "text", originalTitle: "text" });
