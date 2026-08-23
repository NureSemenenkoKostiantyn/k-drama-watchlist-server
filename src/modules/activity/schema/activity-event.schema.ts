import { Schema, type Types } from "mongoose";

import { ActivityType } from "../../../common/types/activity.types";
import { WatchStatus } from "../../../common/types/library.types";

export interface ActivityEventDocument {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId;
  mediaId: Types.ObjectId;
  type: ActivityType;
  status?: WatchStatus;
  rating?: number;
  createdAt: Date;
  deleteAfter: Date;
}

export const ActivityEventSchema = new Schema<ActivityEventDocument>(
  {
    actorUserId: { type: Schema.Types.ObjectId, required: true },
    mediaId: { type: Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WatchStatus),
    },
    rating: { type: Number, min: 1, max: 10 },
    createdAt: { type: Date, required: true, default: Date.now },
    deleteAfter: { type: Date, required: true },
  },
  {
    collection: "activityEvents",
    versionKey: false,
  },
);

ActivityEventSchema.index({ actorUserId: 1, createdAt: -1 });
ActivityEventSchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 });
