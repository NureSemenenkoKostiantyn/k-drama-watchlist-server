import { Module } from "@nestjs/common";

import { FriendshipDataModule } from "../friends/friendship-data.module";
import { MediaModule } from "../media/media.module";
import { SettingsModule } from "../settings/settings.module";
import { UsersModule } from "../users/users.module";
import { activityEventModelProvider } from "./activity-event-model.provider";
import { ActivityController } from "./activity.controller";
import { ActivityRepository } from "./activity.repository";
import { ActivityService } from "./activity.service";

@Module({
  imports: [
    FriendshipDataModule,
    MediaModule,
    SettingsModule,
    UsersModule,
  ],
  controllers: [ActivityController],
  providers: [
    activityEventModelProvider,
    ActivityRepository,
    ActivityService,
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
