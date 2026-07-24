import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type PriorityLaneDocument,
  PriorityLaneSchema,
} from "./schema/priority-lane.schema";

export const PRIORITY_LANE_MODEL_NAME = "PriorityLane";
export const PRIORITY_LANE_MODEL = Symbol("PRIORITY_LANE_MODEL");

export const priorityLaneModelProvider: Provider<
  Model<PriorityLaneDocument>
> = {
  provide: PRIORITY_LANE_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<PriorityLaneDocument> =>
    connection.model<PriorityLaneDocument>(
      PRIORITY_LANE_MODEL_NAME,
      PriorityLaneSchema,
    ),
};
