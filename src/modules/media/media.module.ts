import { Module } from "@nestjs/common";

import { TmdbModule } from "../../integrations/tmdb/tmdb.module";
import { MediaController } from "./media.controller";
import { mediaModelProvider } from "./media-model.provider";
import { MediaRepository } from "./media.repository";
import { MediaService } from "./media.service";
import { SearchController } from "./search.controller";

@Module({
  imports: [TmdbModule],
  controllers: [SearchController, MediaController],
  providers: [mediaModelProvider, MediaRepository, MediaService],
  exports: [MediaRepository, MediaService],
})
export class MediaModule {}
