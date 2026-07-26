import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type UserSettingsDocument,
  UserSettingsSchema,
} from "./schema/user-settings.schema";

export const USER_SETTINGS_MODEL_NAME = "UserSettings";
export const USER_SETTINGS_MODEL = Symbol("USER_SETTINGS_MODEL");

export const userSettingsModelProvider: Provider<
  Model<UserSettingsDocument>
> = {
  provide: USER_SETTINGS_MODEL,
  inject: [getConnectionToken()],
  useFactory: (
    connection: Connection,
  ): Model<UserSettingsDocument> =>
    connection.model<UserSettingsDocument>(
      USER_SETTINGS_MODEL_NAME,
      UserSettingsSchema,
    ),
};
