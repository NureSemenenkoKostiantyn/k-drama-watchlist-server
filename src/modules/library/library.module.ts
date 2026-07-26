import { Module } from "@nestjs/common";

import { CategoriesModule } from "../categories/categories.module";
import { MediaModule } from "../media/media.module";
import { LibraryController } from "./library.controller";
import { LibraryRepository } from "./library.repository";
import { LibraryService } from "./library.service";
import { userMediaModelProvider } from "./user-media-model.provider";
import { USER_MEDIA_MODEL } from "./user-media-model.provider";

@Module({
  imports: [CategoriesModule, MediaModule],
  controllers: [LibraryController],
  providers: [
    userMediaModelProvider,
    LibraryRepository,
    LibraryService,
  ],
  exports: [USER_MEDIA_MODEL, LibraryRepository],
})
export class LibraryModule {}
