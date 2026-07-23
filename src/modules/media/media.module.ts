import { Module } from "@nestjs/common";

import { TmdbModule } from "../../integrations/tmdb/tmdb.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { SearchController } from "./search.controller";

@Module({
  imports: [TmdbModule],
  controllers: [SearchController, MediaController],
  providers: [MediaService],
})
export class MediaModule {}
