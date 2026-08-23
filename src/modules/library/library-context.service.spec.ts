import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  SharedListRole,
  SharedListVisibility,
} from "../../common/types/shared-list.types";
import { type SharedListsRepository } from "../shared-lists/shared-lists.repository";
import { type UsersService } from "../users/users.service";
import { LibraryContextService } from "./library-context.service";
import { type StoredUserMedia } from "./library.repository";
import { WatchStatus } from "../../common/types/library.types";

describe("LibraryContextService", () => {
  const findLists = jest.fn<SharedListsRepository["findAll"]>();
  const findItems = jest.fn<SharedListsRepository["findItemsForLists"]>();
  const findUsers = jest.fn<UsersService["findStoredByIds"]>();
  const service = new LibraryContextService(
    {
      findAll: findLists,
      findItemsForLists: findItems,
    } as unknown as SharedListsRepository,
    { findStoredByIds: findUsers } as unknown as UsersService,
  );

  beforeEach(() => jest.clearAllMocks());

  it("resolves only accessible lists and public suggestion profiles", async () => {
    const userId = new Types.ObjectId();
    const entryId = new Types.ObjectId();
    const mediaId = new Types.ObjectId();
    const suggesterId = new Types.ObjectId();
    const listId = new Types.ObjectId();
    const now = new Date("2026-08-23T00:00:00.000Z");
    const entry: StoredUserMedia = {
      _id: entryId,
      userId,
      mediaId,
      status: WatchStatus.ToWatch,
      categoryIds: [],
      suggestedByUserId: suggesterId,
      createdAt: now,
      updatedAt: now,
    };
    findLists.mockResolvedValue([
      {
        _id: listId,
        ownerId: userId,
        title: "Weekend picks",
        visibility: SharedListVisibility.Private,
        members: [{ userId, role: SharedListRole.Owner, joinedAt: now }],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    findItems.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        listId,
        mediaId,
        addedByUserId: userId,
        position: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    findUsers.mockResolvedValue([
      {
        _id: suggesterId,
        username: "jiwoo",
        displayUsername: "Jiwoo",
        name: "Jiwoo Kim",
        createdAt: now,
      },
    ]);

    const result = await service.resolve(userId, [entry]);

    expect(result.get(entryId.toHexString())).toEqual({
      suggestedBy: {
        id: suggesterId.toHexString(),
        username: "jiwoo",
        displayUsername: "Jiwoo",
        name: "Jiwoo Kim",
        joinedAt: now.toISOString(),
      },
      sharedLists: [{ id: listId.toHexString(), title: "Weekend picks" }],
    });
    expect(findItems).toHaveBeenCalledWith([listId]);
  });
});
