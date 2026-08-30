import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";

import { TelegramApiService } from "./telegram-api.service";
import { TelegramController } from "./telegram.controller";
import { TelegramLinkService } from "./telegram-link.service";
import { TelegramMiniAppAuthService } from "./telegram-mini-app-auth.service";
import { TelegramMiniAppService } from "./telegram-mini-app.service";
import { telegramModelProviders } from "./telegram-model.providers";
import { TelegramRepository } from "./telegram.repository";
import { TelegramUpdateService } from "./telegram-update.service";

@Module({
  imports: [LibraryModule, MediaModule, UsersModule],
  controllers: [TelegramController],
  providers: [
    ...telegramModelProviders,
    TelegramRepository,
    TelegramLinkService,
    TelegramMiniAppAuthService,
    TelegramMiniAppService,
    TelegramUpdateService,
    TelegramApiService,
  ],
  exports: [TelegramLinkService],
})
export class TelegramModule {}
