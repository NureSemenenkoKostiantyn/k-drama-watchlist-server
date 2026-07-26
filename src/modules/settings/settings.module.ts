import { Module } from "@nestjs/common";

import { SettingsController } from "./settings.controller";
import { SettingsRepository } from "./settings.repository";
import { SettingsService } from "./settings.service";
import { userSettingsModelProvider } from "./user-settings-model.provider";

@Module({
  controllers: [SettingsController],
  providers: [
    userSettingsModelProvider,
    SettingsRepository,
    SettingsService,
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
