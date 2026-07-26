import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type NotificationDocument,
  NotificationSchema,
} from "./schema/notification.schema";

export const NOTIFICATION_MODEL_NAME = "Notification";
export const NOTIFICATION_MODEL = Symbol("NOTIFICATION_MODEL");

export const notificationModelProvider: Provider<
  Model<NotificationDocument>
> = {
  provide: NOTIFICATION_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<NotificationDocument> =>
    connection.model<NotificationDocument>(
      NOTIFICATION_MODEL_NAME,
      NotificationSchema,
    ),
};
