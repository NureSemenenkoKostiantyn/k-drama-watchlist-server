import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { SharedListsModule } from "../shared-lists/shared-lists.module";
import { UsersModule } from "../users/users.module";
import {
  CommentsController,
  ListItemCommentsController,
} from "./comments.controller";
import { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";

@Module({
  imports: [NotificationsModule, SharedListsModule, UsersModule],
  controllers: [CommentsController, ListItemCommentsController],
  providers: [CommentsRepository, CommentsService],
})
export class CommentsModule {}
