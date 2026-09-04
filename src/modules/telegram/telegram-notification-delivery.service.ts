import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { NotificationType } from "../../common/types/notification.types";
import { type Environment } from "../../config/environment";
import { type PublishNotificationInput } from "../notifications/notifications.repository";
import { SettingsService } from "../settings/settings.service";
import { UsersService } from "../users/users.service";
import { TelegramApiService } from "./telegram-api.service";
import { TelegramRepository } from "./telegram.repository";

@Injectable()
export class TelegramNotificationDeliveryService {
  private readonly logger = new Logger(
    TelegramNotificationDeliveryService.name,
  );

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly telegramRepository: TelegramRepository,
    private readonly telegramApi: TelegramApiService,
  ) {}

  async deliver(input: PublishNotificationInput): Promise<void> {
    if (
      !this.configService.getOrThrow<boolean>("TELEGRAM_ENABLED") ||
      input.type !== NotificationType.FriendRequest
    ) {
      return;
    }

    try {
      const settings = await this.settingsService.getForUser(input.userId);
      if (!settings.telegramNotifications.friendRequests) {
        return;
      }

      const connection =
        await this.telegramRepository.findConnectionByUserId(input.userId);
      if (!connection) {
        return;
      }

      const actor = input.actorUserId
        ? (await this.usersService.findStoredByIds([input.actorUserId]))[0]
        : undefined;
      const actorLabel = actor
        ? `${actor.name} (@${actor.displayUsername ?? actor.username})`
        : "Someone";

      await this.telegramApi.sendMessage(
        connection.privateChatId,
        `${actorLabel} sent you a friend request on Drama Watch.`,
        [
          [
            {
              text: "Open friend requests",
              url: `${this.configService.getOrThrow<string>("FRONTEND_URL")}/friends`,
            },
          ],
        ],
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          errorName: error instanceof Error ? error.name : "UnknownError",
          notificationType: input.type,
        },
        "Telegram notification delivery failed",
      );
    }
  }
}
