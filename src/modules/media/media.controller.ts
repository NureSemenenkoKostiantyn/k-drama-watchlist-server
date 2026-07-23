import { Controller, Get, Param } from "@nestjs/common";

import { type MediaDetails } from "../../common/types/media.types";
import { MediaIdentityParams } from "./dto/media-identity-params.dto";
import { MediaService } from "./media.service";

@Controller("media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(":mediaType/:tmdbId")
  getDetails(
    @Param() params: MediaIdentityParams,
  ): Promise<MediaDetails> {
    return this.mediaService.getDetails(
      params.mediaType,
      params.tmdbId,
    );
  }
}
