import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import {
  type FriendshipResponse,
  type FriendshipsResponse,
} from "../../common/types/friendship.types";
import { CreateFriendRequestDto } from "./dto/create-friend-request.dto";
import { FriendshipParams } from "./dto/friendship-params.dto";
import { FriendsService } from "./friends.service";

@Controller("friends")
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<FriendshipsResponse> {
    return this.friendsService.list(session.user.id);
  }

  @Post("request")
  request(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreateFriendRequestDto,
  ): Promise<FriendshipResponse> {
    return this.friendsService.request(session.user.id, input);
  }

  @Post(":friendshipId/accept")
  @HttpCode(HttpStatus.OK)
  accept(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: FriendshipParams,
  ): Promise<FriendshipResponse> {
    return this.friendsService.accept(
      session.user.id,
      params.friendshipId,
    );
  }

  @Post(":friendshipId/reject")
  @HttpCode(HttpStatus.NO_CONTENT)
  reject(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: FriendshipParams,
  ): Promise<void> {
    return this.friendsService.reject(
      session.user.id,
      params.friendshipId,
    );
  }

  @Delete(":friendshipId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: FriendshipParams,
  ): Promise<void> {
    return this.friendsService.delete(
      session.user.id,
      params.friendshipId,
    );
  }
}
