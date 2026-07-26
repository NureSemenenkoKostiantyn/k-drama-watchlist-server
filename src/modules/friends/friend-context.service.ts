import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { type MediaFriendContextResponse } from "../../common/types/friend-context.types";
import { type MediaType } from "../../common/types/media.types";
import { LibraryRepository } from "../library/library.repository";
import { MediaRepository } from "../media/media.repository";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import { FriendsRepository } from "./friends.repository";

@Injectable()
export class FriendContextService {
  constructor(
    private readonly friendsRepository: FriendsRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly usersService: UsersService,
  ) {}

  async getForMedia(
    authenticatedUserId: string,
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<MediaFriendContextResponse> {
    const userId = toObjectId(authenticatedUserId);
    const [friendIds, media] = await Promise.all([
      this.friendsRepository.findAcceptedCounterpartIds(userId),
      this.mediaRepository.findByIdentity(mediaType, tmdbId),
    ]);

    if (!media || friendIds.length === 0) {
      return { friends: [] };
    }

    const entries = await this.libraryRepository.findByUsersAndMedia(
      friendIds,
      media._id,
    );

    if (entries.length === 0) {
      return { friends: [] };
    }

    const users = await this.usersService.findStoredByIds(
      entries.map((entry) => entry.userId),
    );
    const usersById = new Map(
      users.map((user) => [user._id.toHexString(), user]),
    );
    const friends = entries.flatMap((entry) => {
      const user = usersById.get(entry.userId.toHexString());

      if (!user) {
        return [];
      }

      return [
        {
          user: toPublicUserProfile(user),
          status: entry.status,
          ...(entry.rating === undefined
            ? {}
            : { rating: entry.rating }),
        },
      ];
    });

    friends.sort((first, second) =>
      first.user.displayUsername.localeCompare(
        second.user.displayUsername,
        undefined,
        { sensitivity: "base" },
      ),
    );

    return { friends };
  }
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}
