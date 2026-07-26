import { Controller, Get, Param } from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type MediaFriendContextResponse } from "../../common/types/friend-context.types";
import { MediaIdentityParams } from "../media/dto/media-identity-params.dto";
import { FriendContextService } from "./friend-context.service";

@Controller("media")
export class FriendContextController {
  constructor(
    private readonly friendContextService: FriendContextService,
  ) {}

  @Get(":mediaType/:tmdbId/friend-context")
  getForMedia(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: MediaIdentityParams,
  ): Promise<MediaFriendContextResponse> {
    return this.friendContextService.getForMedia(
      session.user.id,
      params.mediaType,
      params.tmdbId,
    );
  }
}
