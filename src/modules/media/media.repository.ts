import { Inject, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import {
  type HydratedDocument,
  type Model,
  type Types,
  type UpdateQuery,
} from "mongoose";

import {
  type MediaDetails,
  type MediaSeason,
} from "../../common/types/media.types";
import { MEDIA_MODEL } from "./media-model.provider";
import { type MediaDocument } from "./schema/media.schema";

export interface StoredMedia extends Omit<MediaDetails, "id"> {
  _id: Types.ObjectId;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MediaRepository {
  constructor(
    @Inject(MEDIA_MODEL)
    private readonly mediaModel: Model<MediaDocument>,
  ) {}

  async upsertSnapshot(snapshot: MediaDetails): Promise<StoredMedia> {
    const filter = {
      mediaType: snapshot.mediaType,
      tmdbId: snapshot.tmdbId,
    };
    const update = buildSnapshotUpdate(snapshot);

    try {
      const document = await this.mediaModel
        .findOneAndUpdate(filter, update, {
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
          upsert: true,
        })
        .exec();

      if (!document) {
        throw new Error("Media upsert completed without a document");
      }

      return mapMediaDocument(document);
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const document = await this.mediaModel
        .findOneAndUpdate(filter, update, {
          returnDocument: "after",
          runValidators: true,
        })
        .exec();

      if (!document) {
        throw error;
      }

      return mapMediaDocument(document);
    }
  }

  async findById(mediaId: Types.ObjectId): Promise<StoredMedia | null> {
    const document = await this.mediaModel.findById(mediaId).exec();
    return document ? mapMediaDocument(document) : null;
  }

  async findByIdentity(
    mediaType: MediaDetails["mediaType"],
    tmdbId: number,
  ): Promise<StoredMedia | null> {
    const document = await this.mediaModel
      .findOne({ mediaType, tmdbId })
      .exec();
    return document ? mapMediaDocument(document) : null;
  }

  async findByIds(mediaIds: Types.ObjectId[]): Promise<StoredMedia[]> {
    if (mediaIds.length === 0) {
      return [];
    }

    const documents = await this.mediaModel
      .find({ _id: { $in: mediaIds } })
      .exec();
    return documents.map(mapMediaDocument);
  }
}

export function toMediaDetails(media: StoredMedia): MediaDetails {
  return {
    id: `${media.mediaType}:${media.tmdbId}`,
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    title: media.title,
    originalTitle: media.originalTitle,
    originCountry: [...media.originCountry],
    genreIds: [...media.genreIds],
    ...(media.overview === undefined ? {} : { overview: media.overview }),
    ...(media.posterPath === undefined
      ? {}
      : { posterPath: media.posterPath }),
    ...(media.posterUrl === undefined
      ? {}
      : { posterUrl: media.posterUrl }),
    ...(media.backdropPath === undefined
      ? {}
      : { backdropPath: media.backdropPath }),
    ...(media.backdropUrl === undefined
      ? {}
      : { backdropUrl: media.backdropUrl }),
    ...(media.releaseDate === undefined
      ? {}
      : { releaseDate: media.releaseDate }),
    ...(media.firstAirDate === undefined
      ? {}
      : { firstAirDate: media.firstAirDate }),
    ...(media.releaseStatus === undefined
      ? {}
      : { releaseStatus: media.releaseStatus }),
    ...(media.originalLanguage === undefined
      ? {}
      : { originalLanguage: media.originalLanguage }),
    ...(media.runtimeMinutes === undefined
      ? {}
      : { runtimeMinutes: media.runtimeMinutes }),
    ...(media.totalEpisodes === undefined
      ? {}
      : { totalEpisodes: media.totalEpisodes }),
    ...(media.totalSeasons === undefined
      ? {}
      : { totalSeasons: media.totalSeasons }),
    ...(media.seasons === undefined
      ? {}
      : { seasons: media.seasons.map((season) => ({ ...season })) }),
    ...(media.tmdbVoteAverage === undefined
      ? {}
      : { tmdbVoteAverage: media.tmdbVoteAverage }),
    ...(media.tmdbVoteCount === undefined
      ? {}
      : { tmdbVoteCount: media.tmdbVoteCount }),
  };
}

function buildSnapshotUpdate(
  snapshot: MediaDetails,
): UpdateQuery<MediaDocument> {
  const now = new Date();
  const setValues: Record<string, unknown> = {
    tmdbId: snapshot.tmdbId,
    mediaType: snapshot.mediaType,
    title: snapshot.title,
    originalTitle: snapshot.originalTitle,
    originCountry: snapshot.originCountry,
    genreIds: snapshot.genreIds,
    lastSyncedAt: now,
  };
  const unsetValues: Record<string, 1> = {};

  setOptionalValue(setValues, unsetValues, "overview", snapshot.overview);
  setOptionalValue(
    setValues,
    unsetValues,
    "posterPath",
    snapshot.posterPath,
  );
  setOptionalValue(setValues, unsetValues, "posterUrl", snapshot.posterUrl);
  setOptionalValue(
    setValues,
    unsetValues,
    "backdropPath",
    snapshot.backdropPath,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "backdropUrl",
    snapshot.backdropUrl,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "releaseDate",
    snapshot.releaseDate,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "firstAirDate",
    snapshot.firstAirDate,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "releaseStatus",
    snapshot.releaseStatus,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "originalLanguage",
    snapshot.originalLanguage,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "runtimeMinutes",
    snapshot.runtimeMinutes,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "totalEpisodes",
    snapshot.totalEpisodes,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "totalSeasons",
    snapshot.totalSeasons,
  );
  setOptionalValue(setValues, unsetValues, "seasons", snapshot.seasons);
  setOptionalValue(
    setValues,
    unsetValues,
    "tmdbVoteAverage",
    snapshot.tmdbVoteAverage,
  );
  setOptionalValue(
    setValues,
    unsetValues,
    "tmdbVoteCount",
    snapshot.tmdbVoteCount,
  );

  return {
    $set: setValues,
    $setOnInsert: {
      createdAt: now,
    },
    ...(Object.keys(unsetValues).length === 0
      ? {}
      : { $unset: unsetValues }),
  };
}

function setOptionalValue(
  setValues: Record<string, unknown>,
  unsetValues: Record<string, 1>,
  field: string,
  value: unknown,
): void {
  if (value === undefined) {
    unsetValues[field] = 1;
    return;
  }

  setValues[field] = value;
}

function mapMediaDocument(
  document: HydratedDocument<MediaDocument>,
): StoredMedia {
  return {
    _id: document._id,
    tmdbId: document.tmdbId,
    mediaType: document.mediaType,
    title: document.title,
    originalTitle: document.originalTitle,
    originCountry: [...document.originCountry],
    genreIds: [...document.genreIds],
    lastSyncedAt: document.lastSyncedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.overview === undefined
      ? {}
      : { overview: document.overview }),
    ...(document.posterPath === undefined
      ? {}
      : { posterPath: document.posterPath }),
    ...(document.posterUrl === undefined
      ? {}
      : { posterUrl: document.posterUrl }),
    ...(document.backdropPath === undefined
      ? {}
      : { backdropPath: document.backdropPath }),
    ...(document.backdropUrl === undefined
      ? {}
      : { backdropUrl: document.backdropUrl }),
    ...(document.releaseDate === undefined
      ? {}
      : { releaseDate: document.releaseDate }),
    ...(document.firstAirDate === undefined
      ? {}
      : { firstAirDate: document.firstAirDate }),
    ...(document.releaseStatus === undefined
      ? {}
      : { releaseStatus: document.releaseStatus }),
    ...(document.originalLanguage === undefined
      ? {}
      : { originalLanguage: document.originalLanguage }),
    ...(document.runtimeMinutes === undefined
      ? {}
      : { runtimeMinutes: document.runtimeMinutes }),
    ...(document.totalEpisodes === undefined
      ? {}
      : { totalEpisodes: document.totalEpisodes }),
    ...(document.totalSeasons === undefined
      ? {}
      : { totalSeasons: document.totalSeasons }),
    ...(document.seasons === undefined
      ? {}
      : {
          seasons: document.seasons.map(
            (season): MediaSeason => ({
              seasonNumber: season.seasonNumber,
              name: season.name,
              episodeCount: season.episodeCount,
              ...(season.tmdbSeasonId === undefined
                ? {}
                : { tmdbSeasonId: season.tmdbSeasonId }),
              ...(season.airDate === undefined
                ? {}
                : { airDate: season.airDate }),
              ...(season.posterPath === undefined
                ? {}
                : { posterPath: season.posterPath }),
            }),
          ),
        }),
    ...(document.tmdbVoteAverage === undefined
      ? {}
      : { tmdbVoteAverage: document.tmdbVoteAverage }),
    ...(document.tmdbVoteCount === undefined
      ? {}
      : { tmdbVoteCount: document.tmdbVoteCount }),
  };
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
