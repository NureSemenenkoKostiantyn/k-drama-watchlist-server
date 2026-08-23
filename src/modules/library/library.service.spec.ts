import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import { type CategoriesService } from "../categories/categories.service";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type MediaService } from "../media/media.service";
import { type LibraryContextService } from "./library-context.service";
import {
  type LibraryRepository,
  type StoredUserMedia,
} from "./library.repository";
import { LibraryService } from "./library.service";

describe("LibraryService", () => {
  const findAll = jest.fn<LibraryRepository["findAll"]>();
  const findById = jest.fn<LibraryRepository["findById"]>();
  const findByMedia = jest.fn<LibraryRepository["findByMedia"]>();
  const create = jest.fn<LibraryRepository["create"]>();
  const updateStatus =
    jest.fn<LibraryRepository["updateStatus"]>();
  const updateProgress =
    jest.fn<LibraryRepository["updateProgress"]>();
  const updateRating =
    jest.fn<LibraryRepository["updateRating"]>();
  const updateDetails =
    jest.fn<LibraryRepository["updateDetails"]>();
  const updatePlaybackPreference =
    jest.fn<LibraryRepository["updatePlaybackPreference"]>();
  const deleteEntry = jest.fn<LibraryRepository["delete"]>();
  const findMediaById = jest.fn<MediaRepository["findById"]>();
  const findByIds = jest.fn<MediaRepository["findByIds"]>();
  const findByIdentity =
    jest.fn<MediaRepository["findByIdentity"]>();
  const upsertSnapshot =
    jest.fn<MediaRepository["upsertSnapshot"]>();
  const getDetails = jest.fn<MediaService["getDetails"]>();
  const resolveOwnedIds =
    jest.fn<CategoriesService["resolveOwnedIds"]>();
  const resolveContext = jest.fn<LibraryContextService["resolve"]>();
  const service = new LibraryService(
    {
      findAll,
      findById,
      findByMedia,
      create,
      updateStatus,
      updateProgress,
      updateRating,
      updateDetails,
      updatePlaybackPreference,
      delete: deleteEntry,
    } as unknown as LibraryRepository,
    {
      findById: findMediaById,
      findByIds,
      findByIdentity,
      upsertSnapshot,
    } as unknown as MediaRepository,
    {
      getDetails,
    } as unknown as MediaService,
    {
      resolveOwnedIds,
    } as unknown as CategoriesService,
    {
      resolve: resolveContext,
    } as unknown as LibraryContextService,
  );

  const userId = new Types.ObjectId();
  const mediaId = new Types.ObjectId();
  const entryId = new Types.ObjectId();
  const now = new Date("2026-07-23T20:00:00.000Z");
  const media: StoredMedia = {
    _id: mediaId,
    tmdbId: 496_243,
    mediaType: MediaType.Movie,
    title: "Parasite",
    originalTitle: "기생충",
    originCountry: ["KR"],
    genreIds: [35],
    runtimeMinutes: 133,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const entry: StoredUserMedia = {
    _id: entryId,
    userId,
    mediaId,
    status: WatchStatus.ToWatch,
    categoryIds: [],
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveContext.mockResolvedValue(new Map());
  });

  it("returns suggestion and shared-list context with library entries", async () => {
    const suggesterId = new Types.ObjectId();
    const contextualEntry = { ...entry, suggestedByUserId: suggesterId };
    findAll.mockResolvedValue([contextualEntry]);
    findByIds.mockResolvedValue([media]);
    resolveContext.mockResolvedValue(
      new Map([
        [
          entryId.toHexString(),
          {
            suggestedBy: {
              id: suggesterId.toHexString(),
              username: "jiwoo",
              displayUsername: "Jiwoo",
              name: "Jiwoo Kim",
              joinedAt: now.toISOString(),
            },
            sharedLists: [{ id: "list-1", title: "Weekend picks" }],
          },
        ],
      ]),
    );

    await expect(service.list(userId.toHexString())).resolves.toMatchObject([
      {
        id: entryId.toHexString(),
        suggestedBy: { id: suggesterId.toHexString(), username: "jiwoo" },
        sharedLists: [{ id: "list-1", title: "Weekend picks" }],
      },
    ]);
  });

  it("reuses an existing shared media document for another user", async () => {
    findByIdentity.mockResolvedValue(media);
    findByMedia.mockResolvedValue(null);
    create.mockResolvedValue(entry);

    await expect(
      service.add(userId.toHexString(), {
        mediaType: MediaType.Movie,
        tmdbId: 496_243,
        status: WatchStatus.ToWatch,
      }),
    ).resolves.toMatchObject({
      id: entryId.toHexString(),
      mediaId: mediaId.toHexString(),
      status: WatchStatus.ToWatch,
      media: {
        id: "movie:496243",
        title: "Parasite",
      },
    });

    expect(getDetails).not.toHaveBeenCalled();
    expect(upsertSnapshot).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      userId,
      mediaId,
      WatchStatus.ToWatch,
    );
  });

  it("fetches and stores details when the shared media is new", async () => {
    findByIdentity.mockResolvedValue(null);
    getDetails.mockResolvedValue({
      id: "movie:496243",
      tmdbId: 496_243,
      mediaType: MediaType.Movie,
      title: "Parasite",
      originalTitle: "기생충",
      originCountry: ["KR"],
      genreIds: [35],
      runtimeMinutes: 133,
    });
    upsertSnapshot.mockResolvedValue(media);
    findByMedia.mockResolvedValue(null);
    create.mockResolvedValue(entry);

    await service.add(userId.toHexString(), {
      mediaType: MediaType.Movie,
      tmdbId: 496_243,
      status: WatchStatus.ToWatch,
    });

    expect(getDetails).toHaveBeenCalledWith(
      MediaType.Movie,
      496_243,
    );
    expect(upsertSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate relationship for the same user", async () => {
    findByIdentity.mockResolvedValue(media);
    findByMedia.mockResolvedValue(entry);

    await expect(
      service.add(userId.toHexString(), {
        mediaType: MediaType.Movie,
        tmdbId: 496_243,
        status: WatchStatus.Watching,
      }),
    ).rejects.toMatchObject({
      code: "MEDIA_ALREADY_IN_LIBRARY",
      message: "This title is already in your library.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("calculates season progress and moves an active title to watching", async () => {
    const tvMedia: StoredMedia = {
      ...media,
      mediaType: MediaType.Tv,
      tmdbId: 1,
      title: "Goblin",
      originalTitle: "도깨비",
      runtimeMinutes: undefined,
      totalEpisodes: 4,
      totalSeasons: 2,
      seasons: [
        {
          seasonNumber: 0,
          name: "Specials",
          episodeCount: 1,
        },
        {
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 2,
        },
        {
          seasonNumber: 2,
          name: "Season 2",
          episodeCount: 2,
        },
      ],
    };
    findById.mockResolvedValue(entry);
    findMediaById.mockResolvedValue(tvMedia);
    updateProgress.mockImplementation(
      (_userId, _entryId, update) =>
        Promise.resolve({
          ...entry,
          status: update.status,
          progress: update.progress,
          lastProgressAt: update.lastProgressAt,
          ...(update.startedAt === undefined
            ? {}
            : { startedAt: update.startedAt }),
        }),
    );

    await expect(
      service.updateProgress(userId.toHexString(), entryId.toHexString(), {
        currentSeason: 2,
        currentEpisode: 1,
      }),
    ).resolves.toMatchObject({
      status: WatchStatus.Watching,
      progress: {
        currentSeason: 2,
        currentEpisode: 1,
        completedEpisodes: 3,
        totalEpisodesSnapshot: 4,
        completedSeasonNumbers: [1],
        includeSpecials: false,
      },
    });

    const persistenceUpdate = updateProgress.mock.calls[0]?.[2];
    expect(persistenceUpdate).toMatchObject({
      status: WatchStatus.Watching,
      progress: {
        completedEpisodes: 3,
        totalEpisodesSnapshot: 4,
      },
    });
  });

  it("marks a title watched when all included episodes are complete", async () => {
    const tvMedia: StoredMedia = {
      ...media,
      mediaType: MediaType.Tv,
      tmdbId: 1,
      title: "Goblin",
      originalTitle: "도깨비",
      runtimeMinutes: undefined,
      totalEpisodes: 2,
      totalSeasons: 1,
      seasons: [
        {
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 2,
        },
      ],
    };
    findById.mockResolvedValue(entry);
    findMediaById.mockResolvedValue(tvMedia);
    updateProgress.mockImplementation(
      (_userId, _entryId, update) =>
        Promise.resolve({
          ...entry,
          status: update.status,
          progress: update.progress,
          lastProgressAt: update.lastProgressAt,
          ...(update.completedAt instanceof Date
            ? { completedAt: update.completedAt }
            : {}),
        }),
    );

    await expect(
      service.updateProgress(userId.toHexString(), entryId.toHexString(), {
        currentSeason: 1,
        currentEpisode: 2,
      }),
    ).resolves.toMatchObject({
      status: WatchStatus.Watched,
      progress: {
        completedEpisodes: 2,
        completedSeasonNumbers: [1],
      },
    });
  });

  it("rejects episode progress for movies", async () => {
    findById.mockResolvedValue(entry);
    findMediaById.mockResolvedValue(media);

    await expect(
      service.updateProgress(userId.toHexString(), entryId.toHexString(), {
        currentSeason: 0,
        currentEpisode: 1,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Episode progress is available only for TV titles.",
    });
    expect(updateProgress).not.toHaveBeenCalled();
  });

  it("assigns only categories owned by the authenticated user", async () => {
    const categoryId = new Types.ObjectId();
    findById.mockResolvedValue(entry);
    findMediaById.mockResolvedValue(media);
    resolveOwnedIds.mockResolvedValue([categoryId]);
    updateDetails.mockResolvedValue({
      ...entry,
      categoryIds: [categoryId],
    });

    await expect(
      service.update(userId.toHexString(), entryId.toHexString(), {
        categoryIds: [categoryId.toHexString()],
      }),
    ).resolves.toMatchObject({
      categoryIds: [categoryId.toHexString()],
    });

    expect(resolveOwnedIds).toHaveBeenCalledWith(
      userId.toHexString(),
      [categoryId.toHexString()],
    );
    expect(updateDetails).toHaveBeenCalledWith(userId, entryId, {
      categoryIds: [categoryId],
    });
  });
});
