import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import {
  type LibraryRepository,
  type StoredUserMedia,
} from "../library/library.repository";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type StoredPublicUser } from "../users/users.repository";
import { type UsersService } from "../users/users.service";
import { FriendContextService } from "./friend-context.service";
import { type FriendsRepository } from "./friends.repository";

describe("FriendContextService", () => {
  const authenticatedUserId = new Types.ObjectId();
  const friend = buildUser("dahyun");
  const media = buildMedia();
  const entry = buildEntry(friend._id, media._id);
  const findAcceptedCounterpartIds =
    jest.fn<FriendsRepository["findAcceptedCounterpartIds"]>();
  const findByUsersAndMedia =
    jest.fn<LibraryRepository["findByUsersAndMedia"]>();
  const findByIdentity =
    jest.fn<MediaRepository["findByIdentity"]>();
  const findStoredByIds =
    jest.fn<UsersService["findStoredByIds"]>();
  const service = new FriendContextService(
    {
      findAcceptedCounterpartIds,
    } as unknown as FriendsRepository,
    {
      findByUsersAndMedia,
    } as unknown as LibraryRepository,
    {
      findByIdentity,
    } as unknown as MediaRepository,
    {
      findStoredByIds,
    } as unknown as UsersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only the public status and rating projection", async () => {
    findAcceptedCounterpartIds.mockResolvedValue([friend._id]);
    findByIdentity.mockResolvedValue(media);
    findByUsersAndMedia.mockResolvedValue([entry]);
    findStoredByIds.mockResolvedValue([friend]);

    await expect(
      service.getForMedia(
        authenticatedUserId.toHexString(),
        MediaType.Tv,
        media.tmdbId,
      ),
    ).resolves.toEqual({
      friends: [
        {
          user: {
            id: friend._id.toHexString(),
            username: friend.username,
            displayUsername: friend.username,
            name: friend.name,
            joinedAt: friend.createdAt.toISOString(),
          },
          status: WatchStatus.Watching,
          rating: 8.5,
        },
      ],
    });
  });

  it("does not query private entries when the media is not stored", async () => {
    findAcceptedCounterpartIds.mockResolvedValue([friend._id]);
    findByIdentity.mockResolvedValue(null);

    await expect(
      service.getForMedia(
        authenticatedUserId.toHexString(),
        MediaType.Tv,
        media.tmdbId,
      ),
    ).resolves.toEqual({ friends: [] });
    expect(findByUsersAndMedia).not.toHaveBeenCalled();
    expect(findStoredByIds).not.toHaveBeenCalled();
  });
});

function buildUser(username: string): StoredPublicUser {
  return {
    _id: new Types.ObjectId(),
    username,
    name: "Dahyun Fan",
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
  };
}

function buildMedia(): StoredMedia {
  return {
    _id: new Types.ObjectId(),
    tmdbId: 1,
    mediaType: MediaType.Tv,
    title: "Goblin",
    originalTitle: "Goblin",
    originCountry: ["KR"],
    genreIds: [18],
    lastSyncedAt: new Date("2026-07-26T10:00:00.000Z"),
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
    updatedAt: new Date("2026-07-26T10:00:00.000Z"),
  };
}

function buildEntry(
  userId: Types.ObjectId,
  mediaId: Types.ObjectId,
): StoredUserMedia {
  return {
    _id: new Types.ObjectId(),
    userId,
    mediaId,
    status: WatchStatus.Watching,
    rating: 8.5,
    description: "Private notes must not be exposed.",
    categoryIds: [new Types.ObjectId()],
    playbackPreference: {
      subtitleLanguageCode: "en",
    },
    createdAt: new Date("2026-07-26T11:00:00.000Z"),
    updatedAt: new Date("2026-07-26T12:00:00.000Z"),
  };
}
