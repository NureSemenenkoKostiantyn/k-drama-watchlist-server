import { HttpStatus, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import { ActivityType } from "../../common/types/activity.types";
import {
  type LibraryEntryResponse,
  type LibraryProgress,
  type PlaybackPreference,
  WatchStatus,
} from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import { ActivityService } from "../activity/activity.service";
import { CategoriesService } from "../categories/categories.service";
import {
  MediaRepository,
  type StoredMedia,
  toMediaDetails,
} from "../media/media.repository";
import { MediaService } from "../media/media.service";
import { type AddLibraryEntryDto } from "./dto/add-library-entry.dto";
import { type UpdateLibraryEntryDto } from "./dto/update-library-entry.dto";
import { type UpdatePlaybackPreferenceDto } from "./dto/update-playback-preference.dto";
import { type UpdateProgressDto } from "./dto/update-progress.dto";
import {
  type LibraryEntryContext,
  LibraryContextService,
} from "./library-context.service";
import {
  LibraryRepository,
  type StoredUserMedia,
} from "./library.repository";

@Injectable()
export class LibraryService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaService: MediaService,
    private readonly categoriesService: CategoriesService,
    private readonly libraryContextService: LibraryContextService,
    private readonly activityService: ActivityService,
  ) {}

  async list(
    authenticatedUserId: string,
    status?: WatchStatus,
  ): Promise<LibraryEntryResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const entries = await this.libraryRepository.findAll(userId, status);
    const [media, contexts] = await Promise.all([
      this.mediaRepository.findByIds(entries.map((entry) => entry.mediaId)),
      this.libraryContextService.resolve(userId, entries),
    ]);
    const mediaById = new Map(
      media.map((item) => [item._id.toHexString(), item]),
    );

    return entries.map((entry) => {
      const item = mediaById.get(entry.mediaId.toHexString());

      if (!item) {
        throw new Error(
          `Library entry ${entry._id.toHexString()} references missing media`,
        );
      }

      return toLibraryEntryResponse(
        entry,
        item,
        contexts.get(entry._id.toHexString()),
      );
    });
  }

  async add(
    authenticatedUserId: string,
    input: AddLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
    let media = await this.mediaRepository.findByIdentity(
      input.mediaType,
      input.tmdbId,
    );

    if (!media || media.releaseStatus === undefined) {
      const details = await this.mediaService.getDetails(
        input.mediaType,
        input.tmdbId,
      );
      media = await this.mediaRepository.upsertSnapshot(details);
    }

    const existing = await this.libraryRepository.findByMedia(
      userId,
      media._id,
    );

    if (existing) {
      throw mediaAlreadyInLibrary();
    }

    try {
      const entry = await this.libraryRepository.create(
        userId,
        media._id,
        input.status,
      );
      await this.activityService.publish({
        actorUserId: userId,
        mediaId: media._id,
        type: ActivityType.LibraryAdded,
        status: entry.status,
      });
      return this.withMediaAndContext(userId, entry, media);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw mediaAlreadyInLibrary();
      }

      throw error;
    }
  }

  async get(
    authenticatedUserId: string,
    entryId: string,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
    const entry = await this.findOwnedEntry(
      userId,
      new Types.ObjectId(entryId),
    );
    return this.withMedia(userId, entry);
  }

  async updateStatus(
    authenticatedUserId: string,
    entryId: string,
    status: WatchStatus,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
    const entryIdObject = new Types.ObjectId(entryId);
    const current = await this.findOwnedEntry(userId, entryIdObject);
    const now = new Date();
    const entry = await this.libraryRepository.updateStatus(
      userId,
      entryIdObject,
      status,
      {
        ...(status === WatchStatus.Watching &&
        current.startedAt === undefined
          ? { startedAt: now }
          : {}),
        completedAt:
          status === WatchStatus.Watched
            ? (current.completedAt ?? now)
            : null,
      },
    );

    if (!entry) {
      throw libraryEntryNotFound();
    }

    if (current.status !== entry.status) {
      await this.activityService.publish({
        actorUserId: userId,
        mediaId: entry.mediaId,
        type: ActivityType.LibraryStatusChanged,
        status: entry.status,
      });
    }

    return this.withMedia(userId, entry);
  }

  async updateProgress(
    authenticatedUserId: string,
    entryId: string,
    input: UpdateProgressDto,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
    const entryIdObject = new Types.ObjectId(entryId);
    const current = await this.findOwnedEntry(userId, entryIdObject);
    const media = await this.requireMedia(current);
    const now = new Date();
    const progress = calculateProgress(
      media,
      input,
      input.includeSpecials ??
        current.progress?.includeSpecials ??
        false,
      now,
    );
    const isComplete =
      progress.totalEpisodesSnapshot !== undefined &&
      progress.totalEpisodesSnapshot > 0 &&
      progress.completedEpisodes >=
        progress.totalEpisodesSnapshot;
    const status = isComplete
      ? WatchStatus.Watched
      : progress.completedEpisodes > 0
        ? WatchStatus.Watching
        : WatchStatus.ToWatch;
    const entry = await this.libraryRepository.updateProgress(
      userId,
      entryIdObject,
      {
        progress,
        status,
        lastProgressAt: now,
        ...(status !== WatchStatus.ToWatch &&
        current.startedAt === undefined
          ? { startedAt: now }
          : {}),
        completedAt:
          status === WatchStatus.Watched
            ? (current.completedAt ?? now)
            : null,
      },
    );

    if (!entry) {
      throw libraryEntryNotFound();
    }

    if (current.status !== entry.status) {
      await this.activityService.publish({
        actorUserId: userId,
        mediaId: entry.mediaId,
        type: ActivityType.LibraryStatusChanged,
        status: entry.status,
      });
    }

    return this.withContext(userId, entry, media);
  }

  async updateRating(
    authenticatedUserId: string,
    entryId: string,
    rating: number | null,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
    const entryIdObject = new Types.ObjectId(entryId);
    const current = await this.findOwnedEntry(userId, entryIdObject);
    const entry = await this.libraryRepository.updateRating(
      userId,
      entryIdObject,
      rating,
    );

    if (!entry) {
      throw libraryEntryNotFound();
    }

    if (rating !== null && current.rating !== rating) {
      await this.activityService.publish({
        actorUserId: userId,
        mediaId: entry.mediaId,
        type: ActivityType.LibraryRated,
        rating,
      });
    }

    return this.withMedia(userId, entry);
  }

  async update(
    authenticatedUserId: string,
    entryId: string,
    input: UpdateLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    if (
      input.description === undefined &&
      input.categoryIds === undefined
    ) {
      throw invalidLibraryUpdate();
    }

    const categoryIds =
      input.categoryIds === undefined
        ? undefined
        : await this.categoriesService.resolveOwnedIds(
            authenticatedUserId,
            input.categoryIds,
          );

    return this.updateOwnedEntry(
      authenticatedUserId,
      entryId,
      (userId, entryIdObject) =>
        this.libraryRepository.updateDetails(
          userId,
          entryIdObject,
          {
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
            ...(categoryIds === undefined ? {} : { categoryIds }),
          },
        ),
    );
  }

  async updatePlaybackPreference(
    authenticatedUserId: string,
    entryId: string,
    input: UpdatePlaybackPreferenceDto,
  ): Promise<LibraryEntryResponse> {
    return this.updateOwnedEntry(
      authenticatedUserId,
      entryId,
      (userId, entryIdObject) =>
        this.libraryRepository.updatePlaybackPreference(
          userId,
          entryIdObject,
          normalizePlaybackPreference(input),
        ),
    );
  }

  async delete(
    authenticatedUserId: string,
    entryId: string,
  ): Promise<void> {
    const deleted = await this.libraryRepository.delete(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(entryId),
    );

    if (!deleted) {
      throw libraryEntryNotFound();
    }
  }

  private async findOwnedEntry(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
  ): Promise<StoredUserMedia> {
    const entry = await this.libraryRepository.findById(userId, entryId);

    if (!entry) {
      throw libraryEntryNotFound();
    }

    return entry;
  }

  private async withMedia(
    userId: Types.ObjectId,
    entry: StoredUserMedia,
  ): Promise<LibraryEntryResponse> {
    return this.withMediaAndContext(
      userId,
      entry,
      await this.requireMedia(entry),
    );
  }

  private withMediaAndContext(
    userId: Types.ObjectId,
    entry: StoredUserMedia,
    media: StoredMedia,
  ): Promise<LibraryEntryResponse> {
    return this.withContext(userId, entry, media);
  }

  private async withContext(
    userId: Types.ObjectId,
    entry: StoredUserMedia,
    media: StoredMedia,
  ): Promise<LibraryEntryResponse> {
    const contexts = await this.libraryContextService.resolve(userId, [entry]);
    return toLibraryEntryResponse(
      entry,
      media,
      contexts.get(entry._id.toHexString()),
    );
  }

  private async requireMedia(
    entry: StoredUserMedia,
  ): Promise<StoredMedia> {
    const media = await this.mediaRepository.findById(entry.mediaId);

    if (!media) {
      throw new Error(
        `Library entry ${entry._id.toHexString()} references missing media`,
      );
    }

    return media;
  }

  private async updateOwnedEntry(
    authenticatedUserId: string,
    entryId: string,
    update: (
      userId: Types.ObjectId,
      entryId: Types.ObjectId,
    ) => Promise<StoredUserMedia | null>,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
    const entryIdObject = new Types.ObjectId(entryId);
    await this.findOwnedEntry(userId, entryIdObject);
    const entry = await update(userId, entryIdObject);

    if (!entry) {
      throw libraryEntryNotFound();
    }

    return this.withMedia(userId, entry);
  }
}

function toLibraryEntryResponse(
  entry: StoredUserMedia,
  media: StoredMedia,
  context?: LibraryEntryContext,
): LibraryEntryResponse {
  return {
    id: entry._id.toHexString(),
    mediaId: entry.mediaId.toHexString(),
    status: entry.status,
    media: toMediaDetails(media),
    categoryIds: entry.categoryIds.map((categoryId) =>
      categoryId.toHexString(),
    ),
    sharedLists: context?.sharedLists ?? [],
    ...(context?.suggestedBy === undefined
      ? {}
      : { suggestedBy: context.suggestedBy }),
    ...(entry.priorityLaneId === undefined
      ? {}
      : { priorityLaneId: entry.priorityLaneId.toHexString() }),
    ...(entry.priorityPosition === undefined
      ? {}
      : { priorityPosition: entry.priorityPosition }),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    ...(entry.progress === undefined
      ? {}
      : {
          progress: {
            ...entry.progress,
            completedSeasonNumbers: [
              ...entry.progress.completedSeasonNumbers,
            ],
            updatedAt: entry.progress.updatedAt.toISOString(),
          },
        }),
    ...(entry.rating === undefined ? {} : { rating: entry.rating }),
    ...(entry.description === undefined
      ? {}
      : { description: entry.description }),
    ...(entry.playbackPreference === undefined
      ? {}
      : {
          playbackPreference: {
            ...entry.playbackPreference,
            ...(entry.playbackPreference.audio === undefined
              ? {}
              : {
                  audio: {
                    ...entry.playbackPreference.audio,
                  },
                }),
          },
        }),
    ...(entry.startedAt === undefined
      ? {}
      : { startedAt: entry.startedAt.toISOString() }),
    ...(entry.completedAt === undefined
      ? {}
      : { completedAt: entry.completedAt.toISOString() }),
    ...(entry.lastProgressAt === undefined
      ? {}
      : { lastProgressAt: entry.lastProgressAt.toISOString() }),
  };
}

function calculateProgress(
  media: StoredMedia,
  input: UpdateProgressDto,
  includeSpecials: boolean,
  updatedAt: Date,
): Omit<LibraryProgress, "updatedAt"> & { updatedAt: Date } {
  if (media.mediaType !== MediaType.Tv) {
    throw new ApiException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: "VALIDATION_ERROR",
      message: "Episode progress is available only for TV titles.",
    });
  }

  const seasons = (media.seasons ?? [])
    .filter(
      (season) => includeSpecials || season.seasonNumber !== 0,
    )
    .sort((left, right) => left.seasonNumber - right.seasonNumber);

  if (seasons.length === 0) {
    const totalEpisodesSnapshot = media.totalEpisodes;

    if (
      totalEpisodesSnapshot !== undefined &&
      input.currentEpisode > totalEpisodesSnapshot
    ) {
      throw invalidProgress(
        "The episode exceeds the stored total episode count.",
      );
    }

    return {
      currentSeason: input.currentSeason,
      currentEpisode: input.currentEpisode,
      completedEpisodes: input.currentEpisode,
      completedSeasonNumbers: [],
      includeSpecials,
      updatedAt,
      ...(totalEpisodesSnapshot === undefined
        ? {}
        : { totalEpisodesSnapshot }),
    };
  }

  const currentSeasonIndex = seasons.findIndex(
    (season) => season.seasonNumber === input.currentSeason,
  );

  if (currentSeasonIndex === -1) {
    throw invalidProgress(
      "The selected season is not available for this title.",
    );
  }

  const currentSeason = seasons[currentSeasonIndex];

  if (!currentSeason) {
    throw invalidProgress("The selected season is unavailable.");
  }

  if (input.currentEpisode > currentSeason.episodeCount) {
    throw invalidProgress(
      "The selected episode is outside the stored season.",
    );
  }

  const completedBeforeCurrent = seasons
    .slice(0, currentSeasonIndex)
    .reduce((total, season) => total + season.episodeCount, 0);
  const completedSeasonNumbers = seasons
    .slice(0, currentSeasonIndex)
    .filter((season) => season.episodeCount > 0)
    .map((season) => season.seasonNumber);

  if (
    currentSeason.episodeCount > 0 &&
    input.currentEpisode === currentSeason.episodeCount
  ) {
    completedSeasonNumbers.push(currentSeason.seasonNumber);
  }

  const totalEpisodesSnapshot = seasons.reduce(
    (total, season) => total + season.episodeCount,
    0,
  );

  return {
    currentSeason: input.currentSeason,
    currentEpisode: input.currentEpisode,
    completedEpisodes:
      completedBeforeCurrent + input.currentEpisode,
    completedSeasonNumbers,
    includeSpecials,
    updatedAt,
    ...(totalEpisodesSnapshot > 0
      ? { totalEpisodesSnapshot }
      : {}),
  };
}

function normalizePlaybackPreference(
  input: UpdatePlaybackPreferenceDto,
): PlaybackPreference | null {
  const languageCode = normalizeOptionalText(
    input.audio?.languageCode,
  );
  const customLabel = normalizeOptionalText(input.audio?.customLabel);
  const subtitleLanguageCode = normalizeOptionalText(
    input.subtitleLanguageCode,
  );
  const audio =
    input.audio === undefined || input.audio === null
      ? undefined
      : {
          type: input.audio.type,
          ...(languageCode === undefined ? {} : { languageCode }),
          ...(customLabel === undefined ? {} : { customLabel }),
        };

  if (audio === undefined && subtitleLanguageCode === undefined) {
    return null;
  }

  return {
    ...(audio === undefined ? {} : { audio }),
    ...(subtitleLanguageCode === undefined
      ? {}
      : { subtitleLanguageCode }),
  };
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function invalidProgress(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message,
  });
}

function invalidLibraryUpdate(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message: "Provide a library field to update.",
  });
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function mediaAlreadyInLibrary(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "MEDIA_ALREADY_IN_LIBRARY",
    message: "This title is already in your library.",
  });
}

function libraryEntryNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Library entry not found.",
  });
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
