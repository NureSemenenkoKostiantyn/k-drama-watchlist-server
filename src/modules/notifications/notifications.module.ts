import { Module } from "@nestjs/common";

import { SettingsModule } from "../settings/settings.module";
import { TelegramCoreModule } from "../telegram/telegram-core.module";
import { TelegramNotificationDeliveryService } from "../telegram/telegram-notification-delivery.service";
import { UsersModule } from "../users/users.module";
import { notificationModelProvider } from "./notification-model.provider";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [SettingsModule, TelegramCoreModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    notificationModelProvider,
    NotificationsRepository,
    NotificationsService,
    TelegramNotificationDeliveryService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
