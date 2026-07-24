import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type MediaService } from "../media/media.service";
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
  const deleteEntry = jest.fn<LibraryRepository["delete"]>();
  const findMediaById = jest.fn<MediaRepository["findById"]>();
  const findByIds = jest.fn<MediaRepository["findByIds"]>();
  const findByIdentity =
    jest.fn<MediaRepository["findByIdentity"]>();
  const upsertSnapshot =
    jest.fn<MediaRepository["upsertSnapshot"]>();
  const getDetails = jest.fn<MediaService["getDetails"]>();
  const service = new LibraryService(
    {
      findAll,
      findById,
      findByMedia,
      create,
      updateStatus,
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
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
});
