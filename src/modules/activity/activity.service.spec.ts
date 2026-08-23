import { jest } from "@jest/globals";
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";

import { ActivityType } from "../../common/types/activity.types";
import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import { type FriendsRepository } from "../friends/friends.repository";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type SettingsService } from "../settings/settings.service";
import { type StoredPublicUser } from "../users/users.repository";
import { type UsersService } from "../users/users.service";
import {
  type ActivityRepository,
  type StoredActivityEvent,
} from "./activity.repository";
import { ActivityService } from "./activity.service";

describe("ActivityService", () => {
  const viewerId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const hiddenFriendId = new Types.ObjectId();
  const mediaId = new Types.ObjectId();
  const eventId = new Types.ObjectId();
  const now = new Date("2026-08-23T12:00:00.000Z");
  const findAcceptedCounterpartIds =
    jest.fn<FriendsRepository["findAcceptedCounterpartIds"]>();
  const findVisibleFriendActivityUserIds =
    jest.fn<SettingsService["findVisibleFriendActivityUserIds"]>();
  const findPage = jest.fn<ActivityRepository["findPage"]>();
  const create = jest.fn<ActivityRepository["create"]>();
  const findUsers = jest.fn<UsersService["findStoredByIds"]>();
  const findMedia = jest.fn<MediaRepository["findByIds"]>();
  const service = new ActivityService(
    { findPage, create } as unknown as ActivityRepository,
    { findAcceptedCounterpartIds } as unknown as FriendsRepository,
    { findVisibleFriendActivityUserIds } as unknown as SettingsService,
    { findStoredByIds: findUsers } as unknown as UsersService,
    { findByIds: findMedia } as unknown as MediaRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findAcceptedCounterpartIds.mockResolvedValue([actorId, hiddenFriendId]);
    findVisibleFriendActivityUserIds.mockResolvedValue([actorId]);
    findPage.mockResolvedValue({
      items: [buildEvent()],
      totalResults: 1,
    });
    findUsers.mockResolvedValue([buildUser()]);
    findMedia.mockResolvedValue([buildMedia()]);
  });

  it("returns only accepted friends allowed by their current visibility", async () => {
    await expect(
      service.list(viewerId.toHexString(), { page: 1, limit: 20 }),
    ).resolves.toEqual({
      page: 1,
      totalPages: 1,
      totalResults: 1,
      items: [
        {
          id: eventId.toHexString(),
          type: ActivityType.LibraryStatusChanged,
          actor: {
            id: actorId.toHexString(),
            username: "friend",
            displayUsername: "Friend",
            name: "Drama Friend",
            joinedAt: now.toISOString(),
          },
          media: {
            id: "tv:1",
            tmdbId: 1,
            mediaType: MediaType.Tv,
            title: "Goblin",
            originalTitle: "도깨비",
            posterUrl: "https://image.tmdb.org/goblin.jpg",
            originCountry: ["KR"],
            genreIds: [18],
          },
          status: WatchStatus.Watching,
          createdAt: now.toISOString(),
        },
      ],
    });
    expect(findVisibleFriendActivityUserIds).toHaveBeenCalledWith([
      actorId,
      hiddenFriendId,
    ]);
    expect(findPage).toHaveBeenCalledWith([actorId], 1, 20);
  });

  it("does not let activity delivery failure reject a primary write", async () => {
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    create.mockRejectedValue(new Error("database unavailable"));

    await expect(
      service.publish({
        actorUserId: actorId,
        mediaId,
        type: ActivityType.LibraryRated,
        rating: 9,
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  function buildEvent(): StoredActivityEvent {
    return {
      _id: eventId,
      actorUserId: actorId,
      mediaId,
      type: ActivityType.LibraryStatusChanged,
      status: WatchStatus.Watching,
      createdAt: now,
      deleteAfter: new Date("2027-02-19T12:00:00.000Z"),
    };
  }

  function buildUser(): StoredPublicUser {
    return {
      _id: actorId,
      username: "friend",
      displayUsername: "Friend",
      name: "Drama Friend",
      createdAt: now,
    };
  }

  function buildMedia(): StoredMedia {
    return {
      _id: mediaId,
      tmdbId: 1,
      mediaType: MediaType.Tv,
      title: "Goblin",
      originalTitle: "도깨비",
      posterUrl: "https://image.tmdb.org/goblin.jpg",
      originCountry: ["KR"],
      genreIds: [18],
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }
});
