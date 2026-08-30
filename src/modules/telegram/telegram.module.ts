import { Module } from "@nestjs/common";

import { TelegramApiService } from "./telegram-api.service";
import { TelegramController } from "./telegram.controller";
import { TelegramLinkService } from "./telegram-link.service";
import { telegramModelProviders } from "./telegram-model.providers";
import { TelegramRepository } from "./telegram.repository";
import { TelegramUpdateService } from "./telegram-update.service";

@Module({
  controllers: [TelegramController],
  providers: [
    ...telegramModelProviders,
    TelegramRepository,
    TelegramLinkService,
    TelegramUpdateService,
    TelegramApiService,
  ],
  exports: [TelegramLinkService],
})
export class TelegramModule {}
