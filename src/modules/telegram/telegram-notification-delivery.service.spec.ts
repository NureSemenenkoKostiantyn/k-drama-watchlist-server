import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { NotificationType } from "../../common/types/notification.types";
import {
  ActivityVisibility,
  LibraryVisibility,
} from "../../common/types/settings.types";
import { type Environment } from "../../config/environment";
import type { SettingsService } from "../settings/settings.service";
import type { UsersService } from "../users/users.service";
import type { TelegramApiService } from "./telegram-api.service";
import { TelegramNotificationDeliveryService } from "./telegram-notification-delivery.service";
import type { TelegramRepository } from "./telegram.repository";

describe("TelegramNotificationDeliveryService", () => {
  const recipientId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const getForUser = jest.fn<SettingsService["getForUser"]>();
  const findStoredByIds = jest.fn<UsersService["findStoredByIds"]>();
  const findConnectionByUserId =
    jest.fn<TelegramRepository["findConnectionByUserId"]>();
  const sendMessage = jest.fn<TelegramApiService["sendMessage"]>();
  let telegramEnabled = true;

  beforeEach(() => {
    jest.clearAllMocks();
    telegramEnabled = true;
    getForUser.mockResolvedValue({
      libraryVisibility: LibraryVisibility.Private,
      activityVisibility: ActivityVisibility.Private,
      telegramNotifications: { friendRequests: false },
    });
    findConnectionByUserId.mockResolvedValue(null);
    findStoredByIds.mockResolvedValue([]);
    sendMessage.mockResolvedValue(undefined);
  });

  it("does not inspect preferences when Telegram is disabled", async () => {
    telegramEnabled = false;

    await createService().deliver(friendRequest());

    expect(getForUser).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not send a message without explicit friend-request consent", async () => {
    await createService().deliver(friendRequest());

    expect(getForUser).toHaveBeenCalledWith(recipientId);
    expect(findConnectionByUserId).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("delivers an opted-in friend request to the linked private chat", async () => {
    getForUser.mockResolvedValue({
      libraryVisibility: LibraryVisibility.Private,
      activityVisibility: ActivityVisibility.Private,
      telegramNotifications: { friendRequests: true },
    });
    findConnectionByUserId.mockResolvedValue({
      userId: recipientId,
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Recipient",
      linkedAt: new Date("2026-09-04T12:00:00.000Z"),
    });
    findStoredByIds.mockResolvedValue([
      {
        _id: actorId,
        name: "Demo Viewer",
        username: "demo_viewer",
        displayUsername: "Demo_Viewer",
        createdAt: new Date("2026-07-26T10:00:00.000Z"),
      },
    ]);

    await createService().deliver(friendRequest());

    expect(findConnectionByUserId).toHaveBeenCalledWith(recipientId);
    expect(findStoredByIds).toHaveBeenCalledWith([actorId]);
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Demo Viewer (@Demo_Viewer) sent you a friend request on Drama Watch.",
      [[{ text: "Open friend requests", url: "https://dahyun.best/friends" }]],
    );
  });

  it("ignores notification types that are not enabled in this slice", async () => {
    await createService().deliver({
      ...friendRequest(),
      type: NotificationType.SuggestionReceived,
    });

    expect(getForUser).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  function createService(): TelegramNotificationDeliveryService {
    const configService = {
      getOrThrow: jest.fn((key: keyof Environment) => {
        const values: Partial<Environment> = {
          TELEGRAM_ENABLED: telegramEnabled,
          FRONTEND_URL: "https://dahyun.best",
        };
        return values[key];
      }),
    } as unknown as ConfigService<Environment, true>;

    return new TelegramNotificationDeliveryService(
      configService,
      { getForUser } as unknown as SettingsService,
      { findStoredByIds } as unknown as UsersService,
      { findConnectionByUserId } as unknown as TelegramRepository,
      { sendMessage } as unknown as TelegramApiService,
    );
  }

  function friendRequest() {
    return {
      userId: recipientId,
      type: NotificationType.FriendRequest,
      actorUserId: actorId,
      entityId: new Types.ObjectId(),
    };
  }
});
