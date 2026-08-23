import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type ActivityEventDocument,
  ActivityEventSchema,
} from "./schema/activity-event.schema";

export const ACTIVITY_EVENT_MODEL_NAME = "ActivityEvent";
export const ACTIVITY_EVENT_MODEL = Symbol("ACTIVITY_EVENT_MODEL");

export const activityEventModelProvider: Provider<
  Model<ActivityEventDocument>
> = {
  provide: ACTIVITY_EVENT_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<ActivityEventDocument> =>
    connection.model<ActivityEventDocument>(
      ACTIVITY_EVENT_MODEL_NAME,
      ActivityEventSchema,
    ),
};
