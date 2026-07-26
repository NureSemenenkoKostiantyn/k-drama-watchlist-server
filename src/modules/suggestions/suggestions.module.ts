import { Module } from "@nestjs/common";

import { FriendsModule } from "../friends/friends.module";
import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { suggestionModelProvider } from "./suggestion-model.provider";
import { SuggestionsController } from "./suggestions.controller";
import { SuggestionsRepository } from "./suggestions.repository";
import { SuggestionsService } from "./suggestions.service";

@Module({
  imports: [
    FriendsModule,
    LibraryModule,
    MediaModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [SuggestionsController],
  providers: [
    suggestionModelProvider,
    SuggestionsRepository,
    SuggestionsService,
  ],
})
export class SuggestionsModule {}
