import { HttpStatus, Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { ApiException } from "../../common/errors/api-exception";
import { type PublicUserProfileResponse } from "../../common/types/user.types";
import { rankUserSearchCandidates } from "./user-search";
import {
  type StoredPublicUser,
  UsersRepository,
} from "./users.repository";

const SEARCH_CANDIDATE_LIMIT = 500;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async search(
    authenticatedUserId: string,
    query: string,
    limit: number,
  ): Promise<PublicUserProfileResponse[]> {
    const users = await this.usersRepository.findSearchCandidates(
      query,
      toObjectId(authenticatedUserId),
      SEARCH_CANDIDATE_LIMIT,
    );
    return rankUserSearchCandidates(users, query, limit).map(
      ({ user }) => toPublicUserProfile(user),
    );
  }

  async getById(userId: string): Promise<PublicUserProfileResponse> {
    return toPublicUserProfile(await this.resolveById(userId));
  }

  async resolveById(userId: string): Promise<StoredPublicUser> {
    const user = await this.usersRepository.findById(toObjectId(userId));

    if (!user) {
      throw userNotFound();
    }

    return user;
  }

  async resolveByUsername(username: string): Promise<StoredPublicUser> {
    const user = await this.usersRepository.findByUsername(
      username.toLocaleLowerCase(),
    );

    if (!user) {
      throw userNotFound();
    }

    return user;
  }

  findStoredByIds(userIds: ObjectId[]): Promise<StoredPublicUser[]> {
    return this.usersRepository.findByIds(userIds);
  }
}

function userNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "User not found.",
  });
}

export function toPublicUserProfile(
  user: StoredPublicUser,
): PublicUserProfileResponse {
  return {
    id: user._id.toHexString(),
    username: user.username,
    displayUsername: user.displayUsername ?? user.username,
    name: user.name,
    joinedAt: user.createdAt.toISOString(),
    ...(user.image === undefined ? {} : { image: user.image }),
  };
}

function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new ObjectId(id);
}
