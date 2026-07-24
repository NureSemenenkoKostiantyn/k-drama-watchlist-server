import { Module } from "@nestjs/common";

import { MediaModule } from "../media/media.module";
import { LibraryController } from "./library.controller";
import { LibraryRepository } from "./library.repository";
import { LibraryService } from "./library.service";
import { userMediaModelProvider } from "./user-media-model.provider";

@Module({
  imports: [MediaModule],
  controllers: [LibraryController],
  providers: [
    userMediaModelProvider,
    LibraryRepository,
    LibraryService,
  ],
})
export class LibraryModule {}
