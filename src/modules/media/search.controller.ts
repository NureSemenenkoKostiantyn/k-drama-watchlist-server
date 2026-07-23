import { Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { tmdbSearchRateLimit } from "../../common/throttling/throttling.constants";
import { type MediaSearchResponse } from "../../common/types/media.types";
import { SearchMediaQuery } from "./dto/search-media-query.dto";
import { MediaService } from "./media.service";

@Controller("search")
@Throttle({ default: tmdbSearchRateLimit })
export class SearchController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  search(
    @Query() query: SearchMediaQuery,
  ): Promise<MediaSearchResponse> {
    return this.mediaService.search(query);
  }
}
