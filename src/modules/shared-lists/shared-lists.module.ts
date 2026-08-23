import { Module } from "@nestjs/common";

import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import {
  COMMENT_MODEL,
  commentModelProvider,
} from "../comments/comment-model.provider";
import { sharedListModelProviders } from "./shared-list-model.providers";
import {
  PublicSharedListsController,
  SharedListInvitesController,
  SharedListsController,
} from "./shared-lists.controller";
import { SharedListsRepository } from "./shared-lists.repository";
import { SharedListsService } from "./shared-lists.service";

@Module({
  imports: [MediaModule, NotificationsModule, UsersModule],
  controllers: [
    SharedListsController,
    SharedListInvitesController,
    PublicSharedListsController,
  ],
  providers: [
    commentModelProvider,
    ...sharedListModelProviders,
    SharedListsRepository,
    SharedListsService,
  ],
  exports: [COMMENT_MODEL, SharedListsRepository],
})
export class SharedListsModule {}
