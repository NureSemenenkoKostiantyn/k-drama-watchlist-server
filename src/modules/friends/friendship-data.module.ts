import { Module } from "@nestjs/common";

import { friendshipModelProvider } from "./friendship-model.provider";
import { FriendsRepository } from "./friends.repository";

@Module({
  providers: [friendshipModelProvider, FriendsRepository],
  exports: [FriendsRepository],
})
export class FriendshipDataModule {}
