import { Inject, Injectable } from "@nestjs/common";
import {
  type HydratedDocument,
  type Model,
  Types,
  type UpdateQuery,
} from "mongoose";

import {
  type LibraryProgress,
  type PlaybackPreference,
  WatchStatus,
} from "../../common/types/library.types";
import { USER_MEDIA_MODEL } from "./user-media-model.provider";
import { type UserMediaDocument } from "./schema/user-media.schema";

export interface StoredUserMedia {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  mediaId: Types.ObjectId;
  status: WatchStatus;
  progress?: Omit<LibraryProgress, "updatedAt"> & {
    updatedAt: Date;
  };
  rating?: number;
  description?: string;
  categoryIds: Types.ObjectId[];
  playbackPreference?: PlaybackPreference;
  startedAt?: Date;
  completedAt?: Date;
  lastProgressAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressPersistenceUpdate {
  progress: StoredUserMedia["progress"];
  status: WatchStatus;
  startedAt?: Date;
  completedAt?: Date | null;
  lastProgressAt: Date;
}

@Injectable()
export class LibraryRepository {
  constructor(
    @Inject(USER_MEDIA_MODEL)
    private readonly userMediaModel: Model<UserMediaDocument>,
  ) {}

  async findAll(
    userId: Types.ObjectId,
    status?: WatchStatus,
  ): Promise<StoredUserMedia[]> {
    const filter: {
      userId: Types.ObjectId;
      status?: WatchStatus;
    } = {
      userId,
      ...(status === undefined ? {} : { status }),
    };
    const documents = await this.userMediaModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .exec();
    return documents.map(mapUserMediaDocument);
  }

  async findById(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
  ): Promise<StoredUserMedia | null> {
    const document = await this.userMediaModel
      .findOne({ _id: entryId, userId })
      .exec();
    return document ? mapUserMediaDocument(document) : null;
  }

  async findByMedia(
    userId: Types.ObjectId,
    mediaId: Types.ObjectId,
  ): Promise<StoredUserMedia | null> {
    const document = await this.userMediaModel
      .findOne({ userId, mediaId })
      .exec();
    return document ? mapUserMediaDocument(document) : null;
  }

  async create(
    userId: Types.ObjectId,
    mediaId: Types.ObjectId,
    status: WatchStatus,
  ): Promise<StoredUserMedia> {
    const document = await this.userMediaModel.create({
      userId,
      mediaId,
      status,
      categoryIds: [],
    });
    return mapUserMediaDocument(document);
  }

  async updateStatus(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    status: WatchStatus,
    lifecycle: {
      startedAt?: Date;
      completedAt?: Date | null;
    } = {},
  ): Promise<StoredUserMedia | null> {
    const setValues: Record<string, unknown> = { status };
    const unsetValues: Record<string, 1> = {};

    if (lifecycle.startedAt !== undefined) {
      setValues["startedAt"] = lifecycle.startedAt;
    }

    setOrUnsetDate(
      setValues,
      unsetValues,
      "completedAt",
      lifecycle.completedAt,
    );

    if (status !== WatchStatus.ToWatch) {
      unsetValues["priorityLaneId"] = 1;
      unsetValues["priorityPosition"] = 1;
    }

    return this.updateEntry(userId, entryId, setValues, unsetValues);
  }

  updateProgress(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    update: ProgressPersistenceUpdate,
  ): Promise<StoredUserMedia | null> {
    const setValues: Record<string, unknown> = {
      progress: update.progress,
      status: update.status,
      lastProgressAt: update.lastProgressAt,
    };
    const unsetValues: Record<string, 1> = {};

    if (update.startedAt !== undefined) {
      setValues["startedAt"] = update.startedAt;
    }

    setOrUnsetDate(
      setValues,
      unsetValues,
      "completedAt",
      update.completedAt,
    );

    if (update.status !== WatchStatus.ToWatch) {
      unsetValues["priorityLaneId"] = 1;
      unsetValues["priorityPosition"] = 1;
    }

    return this.updateEntry(userId, entryId, setValues, unsetValues);
  }

  updateRating(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    rating: number | null,
  ): Promise<StoredUserMedia | null> {
    return this.updateEntry(
      userId,
      entryId,
      rating === null ? {} : { rating },
      rating === null ? { rating: 1 } : {},
    );
  }

  updateDetails(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    input: {
      description?: string | null;
      categoryIds?: Types.ObjectId[];
    },
  ): Promise<StoredUserMedia | null> {
    const setValues: Record<string, unknown> = {
      ...(input.description === undefined ||
      input.description === null
        ? {}
        : { description: input.description }),
      ...(input.categoryIds === undefined
        ? {}
        : { categoryIds: input.categoryIds }),
    };

    return this.updateEntry(
      userId,
      entryId,
      setValues,
      input.description === null ? { description: 1 } : {},
    );
  }

  updatePlaybackPreference(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    playbackPreference: PlaybackPreference | null,
  ): Promise<StoredUserMedia | null> {
    return this.updateEntry(
      userId,
      entryId,
      playbackPreference === null ? {} : { playbackPreference },
      playbackPreference === null
        ? { playbackPreference: 1 }
        : {},
    );
  }

  async delete(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.userMediaModel
      .deleteOne({ _id: entryId, userId })
      .exec();
    return result.deletedCount === 1;
  }

  private async updateEntry(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    setValues: Record<string, unknown>,
    unsetValues: Record<string, 1>,
  ): Promise<StoredUserMedia | null> {
    const update: UpdateQuery<UserMediaDocument> = {
      ...(Object.keys(setValues).length === 0
        ? {}
        : { $set: setValues }),
      ...(Object.keys(unsetValues).length === 0
        ? {}
        : { $unset: unsetValues }),
    };
    const document = await this.userMediaModel
      .findOneAndUpdate({ _id: entryId, userId }, update, {
        returnDocument: "after",
        runValidators: true,
      })
      .exec();
    return document ? mapUserMediaDocument(document) : null;
  }
}

function mapUserMediaDocument(
  document: HydratedDocument<UserMediaDocument>,
): StoredUserMedia {
  return {
    _id: document._id,
    userId: document.userId,
    mediaId: document.mediaId,
    status: document.status,
    categoryIds: [...document.categoryIds],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.progress === undefined
      ? {}
      : {
          progress: {
            currentSeason: document.progress.currentSeason,
            currentEpisode: document.progress.currentEpisode,
            completedEpisodes:
              document.progress.completedEpisodes,
            completedSeasonNumbers: [
              ...document.progress.completedSeasonNumbers,
            ],
            includeSpecials: document.progress.includeSpecials,
            updatedAt: document.progress.updatedAt,
            ...(document.progress.totalEpisodesSnapshot === undefined
              ? {}
              : {
                  totalEpisodesSnapshot:
                    document.progress.totalEpisodesSnapshot,
                }),
          },
        }),
    ...(document.rating === undefined ? {} : { rating: document.rating }),
    ...(document.description === undefined
      ? {}
      : { description: document.description }),
    ...(document.playbackPreference === undefined
      ? {}
      : {
          playbackPreference: {
            ...(document.playbackPreference.audio === undefined
              ? {}
              : {
                  audio: {
                    type: document.playbackPreference.audio.type,
                    ...(document.playbackPreference.audio
                      .languageCode === undefined
                      ? {}
                      : {
                          languageCode:
                            document.playbackPreference.audio
                              .languageCode,
                        }),
                    ...(document.playbackPreference.audio
                      .customLabel === undefined
                      ? {}
                      : {
                          customLabel:
                            document.playbackPreference.audio
                              .customLabel,
                        }),
                  },
                }),
            ...(document.playbackPreference
              .subtitleLanguageCode === undefined
              ? {}
              : {
                  subtitleLanguageCode:
                    document.playbackPreference
                      .subtitleLanguageCode,
                }),
          },
        }),
    ...(document.startedAt === undefined
      ? {}
      : { startedAt: document.startedAt }),
    ...(document.completedAt === undefined
      ? {}
      : { completedAt: document.completedAt }),
    ...(document.lastProgressAt === undefined
      ? {}
      : { lastProgressAt: document.lastProgressAt }),
  };
}

function setOrUnsetDate(
  setValues: Record<string, unknown>,
  unsetValues: Record<string, 1>,
  field: string,
  value: Date | null | undefined,
): void {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    unsetValues[field] = 1;
    return;
  }

  setValues[field] = value;
}
