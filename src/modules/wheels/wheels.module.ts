import { Module } from "@nestjs/common";

import { FriendsModule } from "../friends/friends.module";
import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OpenGraphModule } from "../open-graph/open-graph.module";
import { UsersModule } from "../users/users.module";
import { wheelModelProviders } from "./wheel-model.providers";
import {
  PublicWheelsController,
  WheelsController,
} from "./wheels.controller";
import { WheelsRepository } from "./wheels.repository";
import { WheelsService } from "./wheels.service";

@Module({
  imports: [
    FriendsModule,
    MediaModule,
    NotificationsModule,
    OpenGraphModule,
    UsersModule,
  ],
  controllers: [WheelsController, PublicWheelsController],
  providers: [
    ...wheelModelProviders,
    WheelsRepository,
    WheelsService,
  ],
})
export class WheelsModule {}
