import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type FriendshipDocument,
  FriendshipSchema,
} from "./schema/friendship.schema";

export const FRIENDSHIP_MODEL_NAME = "Friendship";
export const FRIENDSHIP_MODEL = Symbol("FRIENDSHIP_MODEL");

export const friendshipModelProvider: Provider<
  Model<FriendshipDocument>
> = {
  provide: FRIENDSHIP_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<FriendshipDocument> =>
    connection.model<FriendshipDocument>(
      FRIENDSHIP_MODEL_NAME,
      FriendshipSchema,
    ),
};
