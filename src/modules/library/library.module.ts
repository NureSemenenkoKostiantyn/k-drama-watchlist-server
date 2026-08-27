import { Module } from "@nestjs/common";

import { ActivityModule } from "../activity/activity.module";
import { CategoriesModule } from "../categories/categories.module";
import { MediaModule } from "../media/media.module";
import { SharedListsModule } from "../shared-lists/shared-lists.module";
import { UsersModule } from "../users/users.module";
import { LibraryContextService } from "./library-context.service";
import { LibraryController } from "./library.controller";
import { LibraryRepository } from "./library.repository";
import { LibraryService } from "./library.service";
import { userMediaModelProvider } from "./user-media-model.provider";
import { USER_MEDIA_MODEL } from "./user-media-model.provider";

@Module({
  imports: [
    ActivityModule,
    CategoriesModule,
    MediaModule,
    SharedListsModule,
    UsersModule,
  ],
  controllers: [LibraryController],
  providers: [
    userMediaModelProvider,
    LibraryRepository,
    LibraryService,
    LibraryContextService,
  ],
  exports: [USER_MEDIA_MODEL, LibraryRepository, LibraryService],
})
export class LibraryModule {}
