import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import {
  type MarkAllNotificationsResponse,
  type NotificationsResponse,
} from "../../common/types/notification.types";
import { NotificationParamsDto } from "./dto/notification-params.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<NotificationsResponse> {
    return this.notificationsService.list(session.user.id);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  markAllRead(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<MarkAllNotificationsResponse> {
    return this.notificationsService.markAllRead(session.user.id);
  }

  @Post(":notificationId/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: NotificationParamsDto,
  ): Promise<void> {
    return this.notificationsService.markRead(
      session.user.id,
      params.notificationId,
    );
  }
}
