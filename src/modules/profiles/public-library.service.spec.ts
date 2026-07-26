import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import { PublicLibrarySort } from "../../common/types/public-library.types";
import { LibraryVisibility } from "../../common/types/settings.types";
import { type FriendsService } from "../friends/friends.service";
import { type SettingsService } from "../settings/settings.service";
import { type StoredPublicUser } from "../users/users.repository";
import { type UsersService } from "../users/users.service";
import { type PublicLibraryQuery } from "./dto/public-library-query.dto";
import {
  type PublicLibraryRepository,
  type StoredPublicLibraryPage,
} from "./public-library.repository";
import { PublicLibraryService } from "./public-library.service";

describe("PublicLibraryService", () => {
  const owner = buildUser("owner");
  const viewerId = new Types.ObjectId();
  const resolveByUsername =
    jest.fn<UsersService["resolveByUsername"]>();
  const getForUser =
    jest.fn<SettingsService["getForUser"]>();
  const areAcceptedFriends =
    jest.fn<FriendsService["areAcceptedFriends"]>();
  const findPage =
    jest.fn<PublicLibraryRepository["findPage"]>();
  const service = new PublicLibraryService(
    { findPage } as unknown as PublicLibraryRepository,
    { resolveByUsername } as unknown as UsersService,
    { getForUser } as unknown as SettingsService,
    { areAcceptedFriends } as unknown as FriendsService,
  );
  const query: PublicLibraryQuery = {
    page: 1,
    limit: 24,
    sort: PublicLibrarySort.RecentlyUpdated,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveByUsername.mockResolvedValue(owner);
    findPage.mockResolvedValue(buildPage());
  });

  it("always allows the owner and returns a safe projection", async () => {
    getForUser.mockResolvedValue({
      libraryVisibility: LibraryVisibility.Private,
    });

    await expect(
      service.getByUsername(
        owner._id.toHexString(),
        owner.username,
        query,
      ),
    ).resolves.toMatchObject({
      user: { username: owner.username },
      visibility: LibraryVisibility.Private,
      isOwner: true,
      totalResults: 1,
      items: [
        {
          status: WatchStatus.Watching,
          rating: 8.5,
          media: {
            id: "tv:1",
            title: "Goblin",
          },
        },
      ],
    });
    expect(areAcceptedFriends).not.toHaveBeenCalled();
  });

  it("allows only accepted friends for friends visibility", async () => {
    getForUser.mockResolvedValue({
      libraryVisibility: LibraryVisibility.Friends,
    });
    areAcceptedFriends.mockResolvedValue(true);

    await expect(
      service.getByUsername(
        viewerId.toHexString(),
        owner.username,
        query,
      ),
    ).resolves.toMatchObject({
      visibility: LibraryVisibility.Friends,
      isOwner: false,
    });
    expect(areAcceptedFriends).toHaveBeenCalledWith(
      viewerId,
      owner._id,
    );
  });

  it("rejects non-friends but permits anonymous public viewing", async () => {
    getForUser.mockResolvedValueOnce({
      libraryVisibility: LibraryVisibility.Friends,
    });
    areAcceptedFriends.mockResolvedValue(false);

    await expect(
      service.getByUsername(
        viewerId.toHexString(),
        owner.username,
        query,
      ),
    ).rejects.toMatchObject({
      code: "LIBRARY_NOT_VISIBLE",
      status: 403,
    });
    expect(findPage).not.toHaveBeenCalled();

    getForUser.mockResolvedValueOnce({
      libraryVisibility: LibraryVisibility.Public,
    });

    await expect(
      service.getByUsername(undefined, owner.username, query),
    ).resolves.toMatchObject({
      visibility: LibraryVisibility.Public,
      isOwner: false,
    });
  });

  it("rejects an inverted release-year range", async () => {
    await expect(
      service.getByUsername(undefined, owner.username, {
        ...query,
        yearFrom: 2025,
        yearTo: 2020,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_YEAR_RANGE",
      status: 400,
    });
    expect(resolveByUsername).not.toHaveBeenCalled();
    expect(findPage).not.toHaveBeenCalled();
  });
});

function buildUser(username: string): StoredPublicUser {
  return {
    _id: new Types.ObjectId(),
    username,
    name: "Library Owner",
    createdAt: new Date("2026-07-27T10:00:00.000Z"),
  };
}

function buildPage(): StoredPublicLibraryPage {
  const now = new Date("2026-07-27T10:00:00.000Z");
  return {
    totalResults: 1,
    items: [
      {
        status: WatchStatus.Watching,
        rating: 8.5,
        media: {
          _id: new Types.ObjectId(),
          tmdbId: 1,
          mediaType: MediaType.Tv,
          title: "Goblin",
          originalTitle: "Goblin",
          originCountry: ["KR"],
          genreIds: [18],
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
    ],
  };
}
