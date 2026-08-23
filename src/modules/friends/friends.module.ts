import { Module } from "@nestjs/common";

import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { FriendContextController } from "./friend-context.controller";
import { FriendContextService } from "./friend-context.service";
import { FriendshipDataModule } from "./friendship-data.module";
import { FriendsController } from "./friends.controller";
import { FriendsService } from "./friends.service";

@Module({
  imports: [
    LibraryModule,
    MediaModule,
    NotificationsModule,
    UsersModule,
    FriendshipDataModule,
  ],
  controllers: [FriendContextController, FriendsController],
  providers: [
    FriendContextService,
    FriendsService,
  ],
  exports: [FriendsService],
})
export class FriendsModule {}
