import { Injectable } from "@nestjs/common";
import { ObjectId, type Collection } from "mongodb";

import { MongooseDatabaseService } from "../../database/mongoose-database.service";

interface AuthUserDocument {
  _id: ObjectId;
  name: string;
  username?: string;
  displayUsername?: string;
  image?: string | null;
  createdAt: Date;
}

export interface StoredPublicUser {
  _id: ObjectId;
  name: string;
  username: string;
  displayUsername?: string;
  image?: string;
  createdAt: Date;
}

@Injectable()
export class UsersRepository {
  constructor(
    private readonly databaseService: MongooseDatabaseService,
  ) {}

  async findByUsername(
    normalizedUsername: string,
  ): Promise<StoredPublicUser | null> {
    const users = await this.getUsersCollection();
    const user = await users.findOne(
      { username: normalizedUsername },
      { projection: publicUserProjection },
    );

    return user && hasUsername(user) ? mapPublicUser(user) : null;
  }

  async searchByUsername(
    normalizedPrefix: string,
    excludedUserId: ObjectId,
    limit: number,
  ): Promise<StoredPublicUser[]> {
    const users = await this.getUsersCollection();
    const prefix = new RegExp(`^${escapeRegularExpression(normalizedPrefix)}`);
    const results = await users
      .find(
        {
          _id: { $ne: excludedUserId },
          username: { $regex: prefix },
        },
        { projection: publicUserProjection },
      )
      .sort({ username: 1 })
      .limit(limit)
      .toArray();

    return results
      .filter(
        hasUsername,
      )
      .map(mapPublicUser);
  }

  private async getUsersCollection(): Promise<
    Collection<AuthUserDocument>
  > {
    const { database } =
      await this.databaseService.getNativeConnection();
    return database.collection<AuthUserDocument>("user");
  }
}

const publicUserProjection = {
  _id: 1,
  name: 1,
  username: 1,
  displayUsername: 1,
  image: 1,
  createdAt: 1,
} as const;

function mapPublicUser(
  user: AuthUserDocument & { username: string },
): StoredPublicUser {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    createdAt: user.createdAt,
    ...(user.displayUsername === undefined
      ? {}
      : { displayUsername: user.displayUsername }),
    ...(typeof user.image === "string" && user.image
      ? { image: user.image }
      : {}),
  };
}

function hasUsername(
  user: AuthUserDocument,
): user is AuthUserDocument & { username: string } {
  return typeof user.username === "string";
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
