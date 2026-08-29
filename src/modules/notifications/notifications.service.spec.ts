import { Logger } from "@nestjs/common";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { NotificationType } from "../../common/types/notification.types";
import { type StoredPublicUser } from "../users/users.repository";
import { type UsersService } from "../users/users.service";
import {
  type NotificationsRepository,
  type StoredNotification,
} from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const userId = new Types.ObjectId();
  const actor = buildActor();
  const notification = buildNotification(userId, actor._id);
  const findRecent =
    jest.fn<NotificationsRepository["findRecent"]>();
  const countUnread =
    jest.fn<NotificationsRepository["countUnread"]>();
  const publish = jest.fn<NotificationsRepository["publish"]>();
  const markRead =
    jest.fn<NotificationsRepository["markRead"]>();
  const markAllRead =
    jest.fn<NotificationsRepository["markAllRead"]>();
  const deleteEntity =
    jest.fn<NotificationsRepository["deleteEntity"]>();
  const findStoredByIds =
    jest.fn<UsersService["findStoredByIds"]>();
  const service = new NotificationsService(
    {
      findRecent,
      countUnread,
      publish,
      markRead,
      markAllRead,
      deleteEntity,
    } as unknown as NotificationsRepository,
    { findStoredByIds } as unknown as UsersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists recent notifications with public actor data", async () => {
    findRecent.mockResolvedValue([notification]);
    countUnread.mockResolvedValue(1);
    findStoredByIds.mockResolvedValue([actor]);

    await expect(
      service.list(userId.toHexString()),
    ).resolves.toEqual({
      items: [
        {
          id: notification._id.toHexString(),
          type: NotificationType.FriendRequest,
          actor: {
            id: actor._id.toHexString(),
            username: actor.username,
            displayUsername: actor.username,
            name: actor.name,
            joinedAt: actor.createdAt.toISOString(),
          },
          entityId: notification.entityId?.toHexString(),
          isRead: false,
          createdAt: notification.createdAt.toISOString(),
        },
      ],
      unreadCount: 1,
    });
  });

  it("keeps ownership checks inside read mutations", async () => {
    markRead.mockResolvedValue(false);

    await expect(
      service.markRead(
        userId.toHexString(),
        notification._id.toHexString(),
      ),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("does not fail the primary action when delivery fails", async () => {
    const logger = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    publish.mockRejectedValue(new Error("database unavailable"));

    await expect(
      service.publish({
        userId,
        type: NotificationType.SuggestionReceived,
        actorUserId: actor._id,
        entityId: notification.entityId,
      }),
    ).resolves.toBeUndefined();
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });

  it("removes entity notifications when their action is revoked", async () => {
    deleteEntity.mockResolvedValue(undefined);

    await service.removeEntity({
      userId,
      type: NotificationType.SharedListInvite,
      entityId: notification.entityId!,
    });

    expect(deleteEntity).toHaveBeenCalledWith(
      userId,
      NotificationType.SharedListInvite,
      notification.entityId,
    );
  });
});

function buildActor(): StoredPublicUser {
  return {
    _id: new Types.ObjectId(),
    username: "dahyun",
    name: "Dahyun",
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
  };
}

function buildNotification(
  userId: Types.ObjectId,
  actorUserId: Types.ObjectId,
): StoredNotification {
  return {
    _id: new Types.ObjectId(),
    userId,
    type: NotificationType.FriendRequest,
    actorUserId,
    entityId: new Types.ObjectId(),
    isRead: false,
    createdAt: new Date("2026-07-26T12:00:00.000Z"),
  };
}
