import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { MediaType } from "../../common/types/media.types";
import {
  SharedListRole,
  SharedListVisibility,
} from "../../common/types/shared-list.types";
import { type ConfigService } from "@nestjs/config";
import { type Environment } from "../../config/environment";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type NotificationsService } from "../notifications/notifications.service";
import { type StoredPublicUser } from "../users/users.repository";
import { type UsersService } from "../users/users.service";
import { type PublicSharedListsQueryDto } from "./dto/public-shared-lists-query.dto";
import {
  type StoredSharedList,
  type SharedListsRepository,
} from "./shared-lists.repository";
import {
  sharedListRoleForUser,
  SharedListsService,
} from "./shared-lists.service";

describe("SharedListsService public discovery", () => {
  const ownerId = new Types.ObjectId();
  const listId = new Types.ObjectId();
  const mediaId = new Types.ObjectId();
  const now = new Date("2026-08-23T12:00:00.000Z");
  const findPublicPage = jest.fn<SharedListsRepository["findPublicPage"]>();
  const summarizeItemsForLists =
    jest.fn<SharedListsRepository["summarizeItemsForLists"]>();
  const findByIds = jest.fn<MediaRepository["findByIds"]>();
  const findStoredByIds = jest.fn<UsersService["findStoredByIds"]>();
  const service = new SharedListsService(
    {
      findPublicPage,
      summarizeItemsForLists,
    } as unknown as SharedListsRepository,
    { findByIds } as unknown as MediaRepository,
    {} as NotificationsService,
    { findStoredByIds } as unknown as UsersService,
    {} as ConfigService<Environment, true>,
  );
  const query: PublicSharedListsQueryDto = { page: 2, limit: 12 };

  beforeEach(() => {
    jest.clearAllMocks();
    findPublicPage.mockResolvedValue({
      lists: [buildPublicList()],
      totalResults: 13,
    });
    summarizeItemsForLists.mockResolvedValue([
      { listId, itemCount: 5, previewMediaIds: [mediaId] },
    ]);
    findByIds.mockResolvedValue([buildMedia()]);
    findStoredByIds.mockResolvedValue([buildUser()]);
  });

  it("returns a paginated public-safe card projection", async () => {
    await expect(service.discoverPublic(query)).resolves.toEqual({
      page: 2,
      totalPages: 2,
      totalResults: 13,
      items: [
        {
          title: "Weekend dramas",
          description: "Public picks",
          publicSlug: "weekend-dramas",
          itemCount: 5,
          owner: {
            id: ownerId.toHexString(),
            username: "owner",
            displayUsername: "Owner",
            name: "List Owner",
            joinedAt: now.toISOString(),
          },
          previewMedia: [
            {
              tmdbId: 1,
              mediaType: MediaType.Tv,
              title: "Goblin",
              posterUrl: "https://image.tmdb.org/goblin.jpg",
            },
          ],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });
    expect(findPublicPage).toHaveBeenCalledWith(2, 12);
    expect(summarizeItemsForLists).toHaveBeenCalledWith([listId], 4);
  });

  it("returns an empty page without requiring related records", async () => {
    findPublicPage.mockResolvedValue({ lists: [], totalResults: 0 });
    summarizeItemsForLists.mockResolvedValue([]);
    findByIds.mockResolvedValue([]);
    findStoredByIds.mockResolvedValue([]);

    await expect(service.discoverPublic({ page: 1, limit: 12 })).resolves.toEqual({
      page: 1,
      totalPages: 0,
      totalResults: 0,
      items: [],
    });
  });

  function buildPublicList(): StoredSharedList {
    return {
      _id: listId,
      ownerId,
      title: "Weekend dramas",
      description: "Public picks",
      visibility: SharedListVisibility.Public,
      publicSlug: "weekend-dramas",
      members: [
        { userId: ownerId, role: SharedListRole.Owner, joinedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    };
  }

  function buildMedia(): StoredMedia {
    return {
      _id: mediaId,
      tmdbId: 1,
      mediaType: MediaType.Tv,
      title: "Goblin",
      originalTitle: "Goblin",
      posterUrl: "https://image.tmdb.org/goblin.jpg",
      originCountry: ["KR"],
      genreIds: [18],
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  function buildUser(): StoredPublicUser {
    return {
      _id: ownerId,
      username: "owner",
      displayUsername: "Owner",
      name: "List Owner",
      createdAt: now,
    };
  }
});

describe("sharedListRoleForUser", () => {
  it("keeps the owner authoritative and resolves every shared role", () => {
    const ownerId = new Types.ObjectId();
    const editorId = new Types.ObjectId();
    const commenterId = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const outsiderId = new Types.ObjectId();
    const now = new Date("2026-08-22T12:00:00.000Z");
    const list: StoredSharedList = {
      _id: new Types.ObjectId(),
      ownerId,
      title: "Friday dramas",
      visibility: SharedListVisibility.Private,
      members: [
        { userId: ownerId, role: SharedListRole.Viewer, joinedAt: now },
        { userId: editorId, role: SharedListRole.Editor, joinedAt: now },
        {
          userId: commenterId,
          role: SharedListRole.Commenter,
          joinedAt: now,
        },
        { userId: viewerId, role: SharedListRole.Viewer, joinedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    };

    expect(sharedListRoleForUser(list, ownerId)).toBe(SharedListRole.Owner);
    expect(sharedListRoleForUser(list, editorId)).toBe(SharedListRole.Editor);
    expect(sharedListRoleForUser(list, commenterId)).toBe(
      SharedListRole.Commenter,
    );
    expect(sharedListRoleForUser(list, viewerId)).toBe(SharedListRole.Viewer);
    expect(sharedListRoleForUser(list, outsiderId)).toBeNull();
  });
});
