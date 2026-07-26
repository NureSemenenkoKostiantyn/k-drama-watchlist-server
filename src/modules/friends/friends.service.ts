import { HttpStatus, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  type FriendshipDirection,
  type FriendshipResponse,
  type FriendshipsResponse,
} from "../../common/types/friendship.types";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import { type StoredPublicUser } from "../users/users.repository";
import { type CreateFriendRequestDto } from "./dto/create-friend-request.dto";
import {
  FriendsRepository,
  type StoredFriendship,
} from "./friends.repository";

@Injectable()
export class FriendsService {
  constructor(
    private readonly friendsRepository: FriendsRepository,
    private readonly usersService: UsersService,
  ) {}

  async list(authenticatedUserId: string): Promise<FriendshipsResponse> {
    const userId = toObjectId(authenticatedUserId);
    const friendships =
      await this.friendsRepository.findAllForUser(userId);
    const counterpartIds = friendships.map((friendship) =>
      counterpartId(friendship, userId),
    );
    const users = await this.usersService.findStoredByIds(
      uniqueObjectIds(counterpartIds),
    );
    const usersById = new Map(
      users.map((user) => [user._id.toHexString(), user]),
    );
    const response: FriendshipsResponse = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };

    for (const friendship of friendships) {
      const user = usersById.get(
        counterpartId(friendship, userId).toHexString(),
      );

      if (!user || friendship.status === "blocked") {
        continue;
      }

      const mapped = toFriendshipResponse(friendship, user, userId);

      if (friendship.status === "accepted") {
        response.friends.push(mapped);
      } else if (mapped.direction === "incoming") {
        response.incomingRequests.push(mapped);
      } else {
        response.outgoingRequests.push(mapped);
      }
    }

    return response;
  }

  async request(
    authenticatedUserId: string,
    input: CreateFriendRequestDto,
  ): Promise<FriendshipResponse> {
    const requesterId = toObjectId(authenticatedUserId);
    const recipient = await this.usersService.resolveByUsername(
      input.username,
    );

    if (requesterId.equals(recipient._id)) {
      throw invalidFriendRequest(
        "You cannot send a friend request to yourself.",
      );
    }

    try {
      const friendship = await this.friendsRepository.create(
        requesterId,
        recipient._id,
        createPairKey(requesterId, recipient._id),
      );
      return toFriendshipResponse(
        friendship,
        recipient,
        requesterId,
      );
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw friendshipAlreadyExists();
      }

      throw error;
    }
  }

  async accept(
    authenticatedUserId: string,
    friendshipId: string,
  ): Promise<FriendshipResponse> {
    const recipientId = toObjectId(authenticatedUserId);
    const friendship = await this.friendsRepository.accept(
      new Types.ObjectId(friendshipId),
      recipientId,
      new Date(),
    );

    if (!friendship) {
      throw friendshipNotFound();
    }

    const [requester] = await this.usersService.findStoredByIds([
      friendship.requesterId,
    ]);

    if (!requester) {
      throw friendshipNotFound();
    }

    return toFriendshipResponse(friendship, requester, recipientId);
  }

  async reject(
    authenticatedUserId: string,
    friendshipId: string,
  ): Promise<void> {
    const rejected = await this.friendsRepository.reject(
      new Types.ObjectId(friendshipId),
      toObjectId(authenticatedUserId),
    );

    if (!rejected) {
      throw friendshipNotFound();
    }
  }

  async delete(
    authenticatedUserId: string,
    friendshipId: string,
  ): Promise<void> {
    const deleted = await this.friendsRepository.deleteForParticipant(
      new Types.ObjectId(friendshipId),
      toObjectId(authenticatedUserId),
    );

    if (!deleted) {
      throw friendshipNotFound();
    }
  }
}

export function createPairKey(
  firstUserId: Types.ObjectId,
  secondUserId: Types.ObjectId,
): string {
  return [firstUserId.toHexString(), secondUserId.toHexString()]
    .sort()
    .join(":");
}

function toFriendshipResponse(
  friendship: StoredFriendship,
  user: StoredPublicUser,
  authenticatedUserId: Types.ObjectId,
): FriendshipResponse {
  const direction: FriendshipDirection =
    friendship.recipientId.equals(authenticatedUserId)
      ? "incoming"
      : "outgoing";

  return {
    id: friendship._id.toHexString(),
    status: friendship.status,
    direction,
    user: toPublicUserProfile(user),
    createdAt: friendship.createdAt.toISOString(),
    ...(friendship.acceptedAt === undefined
      ? {}
      : { acceptedAt: friendship.acceptedAt.toISOString() }),
  };
}

function counterpartId(
  friendship: StoredFriendship,
  authenticatedUserId: Types.ObjectId,
): Types.ObjectId {
  return friendship.requesterId.equals(authenticatedUserId)
    ? friendship.recipientId
    : friendship.requesterId;
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [
    ...new Map(ids.map((id) => [id.toHexString(), id])).values(),
  ];
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function invalidFriendRequest(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "INVALID_FRIEND_REQUEST",
    message,
  });
}

function friendshipAlreadyExists(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "FRIENDSHIP_ALREADY_EXISTS",
    message: "A friendship or pending request already exists.",
  });
}

function friendshipNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Friendship not found.",
  });
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
