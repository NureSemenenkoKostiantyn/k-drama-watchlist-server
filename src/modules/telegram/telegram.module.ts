import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { WheelsModule } from "../wheels/wheels.module";

import { TelegramCoreModule } from "./telegram-core.module";
import { TelegramController } from "./telegram.controller";
import { TelegramLinkService } from "./telegram-link.service";
import { TelegramMiniAppAuthService } from "./telegram-mini-app-auth.service";
import { TelegramMiniAppService } from "./telegram-mini-app.service";
import { TelegramUpdateService } from "./telegram-update.service";

@Module({
  imports: [
    LibraryModule,
    MediaModule,
    TelegramCoreModule,
    UsersModule,
    WheelsModule,
  ],
  controllers: [TelegramController],
  providers: [
    TelegramLinkService,
    TelegramMiniAppAuthService,
    TelegramMiniAppService,
    TelegramUpdateService,
  ],
  exports: [TelegramLinkService],
})
export class TelegramModule {}
