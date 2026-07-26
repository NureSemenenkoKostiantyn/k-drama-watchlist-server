import { Module } from "@nestjs/common";

import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { FriendContextController } from "./friend-context.controller";
import { FriendContextService } from "./friend-context.service";
import { friendshipModelProvider } from "./friendship-model.provider";
import { FriendsController } from "./friends.controller";
import { FriendsRepository } from "./friends.repository";
import { FriendsService } from "./friends.service";

@Module({
  imports: [
    LibraryModule,
    MediaModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [FriendContextController, FriendsController],
  providers: [
    friendshipModelProvider,
    FriendContextService,
    FriendsRepository,
    FriendsService,
  ],
  exports: [FriendsService],
})
export class FriendsModule {}
