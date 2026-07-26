import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  type MarkAllNotificationsResponse,
  type NotificationResponse,
  type NotificationsResponse,
} from "../../common/types/notification.types";
import { type StoredPublicUser } from "../users/users.repository";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import {
  type PublishNotificationInput,
  type StoredNotification,
  NotificationsRepository,
} from "./notifications.repository";

const MAX_NOTIFICATIONS = 50;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly usersService: UsersService,
  ) {}

  async list(authenticatedUserId: string): Promise<NotificationsResponse> {
    const userId = toObjectId(authenticatedUserId);
    const [notifications, unreadCount] = await Promise.all([
      this.notificationsRepository.findRecent(
        userId,
        MAX_NOTIFICATIONS,
      ),
      this.notificationsRepository.countUnread(userId),
    ]);
    const actorIds = notifications.flatMap((notification) =>
      notification.actorUserId === undefined
        ? []
        : [notification.actorUserId],
    );
    const actors = await this.usersService.findStoredByIds(
      uniqueObjectIds(actorIds),
    );
    const actorsById = new Map(
      actors.map((actor) => [actor._id.toHexString(), actor]),
    );

    return {
      items: notifications.map((notification) =>
        toNotificationResponse(
          notification,
          notification.actorUserId === undefined
            ? undefined
            : actorsById.get(notification.actorUserId.toHexString()),
        ),
      ),
      unreadCount,
    };
  }

  async markRead(
    authenticatedUserId: string,
    notificationId: string,
  ): Promise<void> {
    const updated = await this.notificationsRepository.markRead(
      new Types.ObjectId(notificationId),
      toObjectId(authenticatedUserId),
      new Date(),
    );

    if (!updated) {
      throw notificationNotFound();
    }
  }

  async markAllRead(
    authenticatedUserId: string,
  ): Promise<MarkAllNotificationsResponse> {
    return {
      updatedCount: await this.notificationsRepository.markAllRead(
        toObjectId(authenticatedUserId),
        new Date(),
      ),
    };
  }

  async publish(input: PublishNotificationInput): Promise<void> {
    try {
      await this.notificationsRepository.publish(input, new Date());
    } catch (error: unknown) {
      this.logger.error(
        {
          error,
          notificationType: input.type,
          recipientId: input.userId.toHexString(),
        },
        "Notification delivery failed",
      );
    }
  }
}

function toNotificationResponse(
  notification: StoredNotification,
  actor?: StoredPublicUser,
): NotificationResponse {
  return {
    id: notification._id.toHexString(),
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    ...(actor === undefined
      ? {}
      : { actor: toPublicUserProfile(actor) }),
    ...(notification.entityId === undefined
      ? {}
      : { entityId: notification.entityId.toHexString() }),
    ...(notification.readAt === undefined
      ? {}
      : { readAt: notification.readAt.toISOString() }),
  };
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [
    ...new Map(ids.map((id) => [id.toHexString(), id])).values(),
  ];
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function notificationNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Notification not found.",
  });
}
