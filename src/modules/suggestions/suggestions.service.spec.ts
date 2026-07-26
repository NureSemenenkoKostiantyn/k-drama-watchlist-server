import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { MediaType } from "../../common/types/media.types";
import { SuggestionStatus } from "../../common/types/suggestion.types";
import { type FriendsService } from "../friends/friends.service";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type MediaService } from "../media/media.service";
import { type StoredPublicUser } from "../users/users.repository";
import { type UsersService } from "../users/users.service";
import {
  type StoredSuggestion,
  type SuggestionsRepository,
} from "./suggestions.repository";
import { SuggestionsService } from "./suggestions.service";

describe("SuggestionsService", () => {
  const sender = buildUser("sender");
  const recipient = buildUser("recipient");
  const media = buildMedia();
  const suggestion = buildSuggestion();
  const findAllForUser =
    jest.fn<SuggestionsRepository["findAllForUser"]>();
  const create = jest.fn<SuggestionsRepository["create"]>();
  const accept = jest.fn<SuggestionsRepository["accept"]>();
  const dismiss = jest.fn<SuggestionsRepository["dismiss"]>();
  const areAcceptedFriends =
    jest.fn<FriendsService["areAcceptedFriends"]>();
  const resolveByUsername =
    jest.fn<UsersService["resolveByUsername"]>();
  const findStoredByIds =
    jest.fn<UsersService["findStoredByIds"]>();
  const findByIdentity =
    jest.fn<MediaRepository["findByIdentity"]>();
  const findByIds = jest.fn<MediaRepository["findByIds"]>();
  const findById = jest.fn<MediaRepository["findById"]>();
  const upsertSnapshot =
    jest.fn<MediaRepository["upsertSnapshot"]>();
  const getDetails = jest.fn<MediaService["getDetails"]>();
  const service = new SuggestionsService(
    {
      findAllForUser,
      create,
      accept,
      dismiss,
    } as unknown as SuggestionsRepository,
    { areAcceptedFriends } as unknown as FriendsService,
    {
      resolveByUsername,
      findStoredByIds,
    } as unknown as UsersService,
    {
      findByIdentity,
      findByIds,
      findById,
      upsertSnapshot,
    } as unknown as MediaRepository,
    { getDetails } as unknown as MediaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a suggestion only for an accepted friend", async () => {
    resolveByUsername.mockResolvedValue(recipient);
    areAcceptedFriends.mockResolvedValue(true);
    findByIdentity.mockResolvedValue(media);
    create.mockResolvedValue(suggestion);

    await expect(
      service.create(sender._id.toHexString(), {
        username: recipient.username,
        mediaType: MediaType.Tv,
        tmdbId: media.tmdbId,
        message: "Watch this next",
      }),
    ).resolves.toMatchObject({
      status: SuggestionStatus.Pending,
      direction: "sent",
      user: { username: recipient.username },
      media: { title: media.title },
      message: "Watch this next",
    });
    expect(create).toHaveBeenCalledWith(
      sender._id,
      recipient._id,
      media._id,
      "Watch this next",
    );
  });

  it("rejects suggestions to users who are not accepted friends", async () => {
    resolveByUsername.mockResolvedValue(recipient);
    areAcceptedFriends.mockResolvedValue(false);

    await expect(
      service.create(sender._id.toHexString(), {
        username: recipient.username,
        mediaType: MediaType.Tv,
        tmdbId: media.tmdbId,
      }),
    ).rejects.toMatchObject({
      code: "FRIENDSHIP_REQUIRED",
      status: 403,
    });
    expect(findByIdentity).not.toHaveBeenCalled();
  });

  it("accepts for the recipient and returns the persisted result", async () => {
    accept.mockResolvedValue({
      ...suggestion,
      status: SuggestionStatus.Accepted,
      respondedAt: new Date("2026-07-27T10:00:00.000Z"),
    });
    findStoredByIds.mockResolvedValue([sender]);
    findById.mockResolvedValue(media);

    await expect(
      service.accept(
        recipient._id.toHexString(),
        suggestion._id.toHexString(),
      ),
    ).resolves.toMatchObject({
      status: SuggestionStatus.Accepted,
      direction: "received",
      user: { username: sender.username },
    });
  });

  function buildUser(username: string): StoredPublicUser {
    return {
      _id: new Types.ObjectId(),
      username,
      name: `${username} name`,
      createdAt: new Date("2026-07-26T10:00:00.000Z"),
    };
  }

  function buildMedia(): StoredMedia {
    return {
      _id: new Types.ObjectId(),
      tmdbId: 67915,
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

  function buildSuggestion(): StoredSuggestion {
    return {
      _id: new Types.ObjectId(),
      fromUserId: sender._id,
      toUserId: recipient._id,
      mediaId: media._id,
      message: "Watch this next",
      status: SuggestionStatus.Pending,
      createdAt: new Date("2026-07-26T11:00:00.000Z"),
    };
  }
});
