import { HttpStatus, Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { ApiException } from "../../common/errors/api-exception";
import { type PublicUserProfileResponse } from "../../common/types/user.types";
import {
  type StoredPublicUser,
  UsersRepository,
} from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async search(
    authenticatedUserId: string,
    query: string,
    limit: number,
  ): Promise<PublicUserProfileResponse[]> {
    const users = await this.usersRepository.searchByUsername(
      query.toLocaleLowerCase(),
      toObjectId(authenticatedUserId),
      limit,
    );
    return users.map(toPublicUserProfile);
  }

  async getByUsername(
    username: string,
  ): Promise<PublicUserProfileResponse> {
    const user = await this.usersRepository.findByUsername(
      username.toLocaleLowerCase(),
    );

    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        code: "NOT_FOUND",
        message: "User not found.",
      });
    }

    return toPublicUserProfile(user);
  }
}

function toPublicUserProfile(
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
