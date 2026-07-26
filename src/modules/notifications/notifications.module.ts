import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { notificationModelProvider } from "./notification-model.provider";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [
    notificationModelProvider,
    NotificationsRepository,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
