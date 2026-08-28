import { Inject, Injectable } from "@nestjs/common";
import {
  type HydratedDocument,
  type Model,
  Types,
} from "mongoose";

import { NotificationType } from "../../common/types/notification.types";
import { NOTIFICATION_MODEL } from "./notification-model.provider";
import { type NotificationDocument } from "./schema/notification.schema";

export interface StoredNotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  actorUserId?: Types.ObjectId;
  entityId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface PublishNotificationInput {
  userId: Types.ObjectId;
  type: NotificationType;
  actorUserId?: Types.ObjectId;
  entityId?: Types.ObjectId;
}

@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(NOTIFICATION_MODEL)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async findRecent(
    userId: Types.ObjectId,
    limit: number,
  ): Promise<StoredNotification[]> {
    const documents = await this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return documents.map(mapNotification);
  }

  countUnread(userId: Types.ObjectId): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId, isRead: false })
      .exec();
  }

  async publish(
    input: PublishNotificationInput,
    createdAt: Date,
  ): Promise<void> {
    await this.notificationModel
      .findOneAndUpdate(
        {
          userId: input.userId,
          type: input.type,
          ...(input.entityId === undefined
            ? {}
            : { entityId: input.entityId }),
        },
        {
          $set: {
            isRead: false,
            createdAt,
            ...(input.actorUserId === undefined
              ? {}
              : { actorUserId: input.actorUserId }),
          },
          $unset: { readAt: 1 },
          $setOnInsert: {
            userId: input.userId,
            type: input.type,
            ...(input.entityId === undefined
              ? {}
              : { entityId: input.entityId }),
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
  }

  async markRead(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
    readAt: Date,
  ): Promise<boolean> {
    const document = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationId,
          userId,
        },
        {
          $set: {
            isRead: true,
            readAt,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document !== null;
  }

  async markAllRead(
    userId: Types.ObjectId,
    readAt: Date,
  ): Promise<number> {
    const result = await this.notificationModel
      .updateMany(
        {
          userId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt,
          },
        },
        { runValidators: true },
      )
      .exec();
    return result.modifiedCount;
  }

  async markEntityRead(
    userId: Types.ObjectId,
    type: NotificationType,
    entityId: Types.ObjectId,
    readAt: Date,
  ): Promise<void> {
    await this.notificationModel
      .updateOne(
        { userId, type, entityId, isRead: false },
        { $set: { isRead: true, readAt } },
        { runValidators: true },
      )
      .exec();
  }

  async deleteEntity(
    userId: Types.ObjectId,
    type: NotificationType,
    entityId: Types.ObjectId,
  ): Promise<void> {
    await this.notificationModel
      .deleteMany({ userId, type, entityId })
      .exec();
  }
}

function mapNotification(
  document: HydratedDocument<NotificationDocument>,
): StoredNotification {
  return {
    _id: document._id,
    userId: document.userId,
    type: document.type,
    isRead: document.isRead,
    createdAt: document.createdAt,
    ...(document.actorUserId === undefined
      ? {}
      : { actorUserId: document.actorUserId }),
    ...(document.entityId === undefined
      ? {}
      : { entityId: document.entityId }),
    ...(document.readAt === undefined
      ? {}
      : { readAt: document.readAt }),
  };
}
