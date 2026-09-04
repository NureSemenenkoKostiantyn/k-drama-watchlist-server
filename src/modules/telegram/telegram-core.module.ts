import { Module } from "@nestjs/common";

import { TelegramApiService } from "./telegram-api.service";
import { telegramModelProviders } from "./telegram-model.providers";
import { TelegramRepository } from "./telegram.repository";

@Module({
  providers: [
    ...telegramModelProviders,
    TelegramRepository,
    TelegramApiService,
  ],
  exports: [TelegramRepository, TelegramApiService],
})
export class TelegramCoreModule {}
