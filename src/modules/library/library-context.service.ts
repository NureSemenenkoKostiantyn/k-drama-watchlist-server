import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import {
  type LibrarySharedListReference,
} from "../../common/types/library.types";
import { type PublicUserProfileResponse } from "../../common/types/user.types";
import { SharedListsRepository } from "../shared-lists/shared-lists.repository";
import { UsersService, toPublicUserProfile } from "../users/users.service";
import { type StoredUserMedia } from "./library.repository";

export interface LibraryEntryContext {
  suggestedBy?: PublicUserProfileResponse;
  sharedLists: LibrarySharedListReference[];
}

@Injectable()
export class LibraryContextService {
  constructor(
    private readonly sharedListsRepository: SharedListsRepository,
    private readonly usersService: UsersService,
  ) {}

  async resolve(
    userId: Types.ObjectId,
    entries: StoredUserMedia[],
  ): Promise<Map<string, LibraryEntryContext>> {
    if (entries.length === 0) {
      return new Map();
    }

    const suggestedByIds = uniqueObjectIds(
      entries.flatMap((entry) =>
        entry.suggestedByUserId === undefined ? [] : [entry.suggestedByUserId],
      ),
    );
    const [lists, suggesters] = await Promise.all([
      this.sharedListsRepository.findAll(userId),
      this.usersService.findStoredByIds(suggestedByIds),
    ]);
    const listItems = await this.sharedListsRepository.findItemsForLists(
      lists.map((list) => list._id),
    );
    const listsById = new Map(lists.map((list) => [list._id.toHexString(), list]));
    const listReferencesByMediaId = new Map<string, LibrarySharedListReference[]>();

    for (const item of listItems) {
      const list = listsById.get(item.listId.toHexString());

      if (!list) {
        continue;
      }

      const mediaId = item.mediaId.toHexString();
      const references = listReferencesByMediaId.get(mediaId) ?? [];
      references.push({ id: list._id.toHexString(), title: list.title });
      listReferencesByMediaId.set(mediaId, references);
    }

    const suggestersById = new Map(
      suggesters.map((user) => [user._id.toHexString(), toPublicUserProfile(user)]),
    );

    return new Map(
      entries.map((entry) => [
        entry._id.toHexString(),
        {
          sharedLists: listReferencesByMediaId.get(entry.mediaId.toHexString()) ?? [],
          ...(entry.suggestedByUserId === undefined
            ? {}
            : {
                suggestedBy: suggestersById.get(entry.suggestedByUserId.toHexString()),
              }),
        },
      ]),
    );
  }
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
}
