import {
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Body,
} from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import {
  type TelegramConnectionResponse,
  type TelegramLinkResponse,
} from "../../common/types/telegram.types";
import { TelegramLinkService } from "./telegram-link.service";
import { TelegramUpdateService } from "./telegram-update.service";

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly linkService: TelegramLinkService,
    private readonly updateService: TelegramUpdateService,
  ) {}

  @Get("connection")
  @Header("Cache-Control", "no-store")
  getConnection(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<TelegramConnectionResponse> {
    return this.linkService.getConnection(session.user.id);
  }

  @Post("link")
  @Header("Cache-Control", "no-store")
  createLink(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<TelegramLinkResponse> {
    return this.linkService.createLink(session.user.id);
  }

  @Delete("connection")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<void> {
    return this.linkService.disconnect(session.user.id);
  }

  @Post("webhook")
  @AllowAnonymous()
  @HttpCode(HttpStatus.NO_CONTENT)
  webhook(
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Body() input: unknown,
  ): Promise<void> {
    return this.updateService.handle(secret, input);
  }
}
