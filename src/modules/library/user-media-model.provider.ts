import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type UserMediaDocument,
  UserMediaSchema,
} from "./schema/user-media.schema";

export const USER_MEDIA_MODEL_NAME = "UserMedia";
export const USER_MEDIA_MODEL = Symbol("USER_MEDIA_MODEL");

export const userMediaModelProvider: Provider<Model<UserMediaDocument>> = {
  provide: USER_MEDIA_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<UserMediaDocument> =>
    connection.model<UserMediaDocument>(
      USER_MEDIA_MODEL_NAME,
      UserMediaSchema,
    ),
};
