import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { friendshipModelProvider } from "./friendship-model.provider";
import { FriendsController } from "./friends.controller";
import { FriendsRepository } from "./friends.repository";
import { FriendsService } from "./friends.service";

@Module({
  imports: [UsersModule],
  controllers: [FriendsController],
  providers: [
    friendshipModelProvider,
    FriendsRepository,
    FriendsService,
  ],
  exports: [FriendsService],
})
export class FriendsModule {}
