import { Schema, type Types } from "mongoose";

import { NotificationType } from "../../../common/types/notification.types";

export interface NotificationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  actorUserId?: Types.ObjectId;
  entityId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    actorUserId: Schema.Types.ObjectId,
    entityId: Schema.Types.ObjectId,
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    readAt: Date,
  },
  {
    collection: "notifications",
    versionKey: false,
  },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index(
  { userId: 1, type: 1, entityId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      entityId: { $exists: true },
    },
  },
);
