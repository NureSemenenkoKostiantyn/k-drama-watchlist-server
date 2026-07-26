import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type PublicUserProfileResponse } from "../../common/types/user.types";
import { SearchUsersQuery } from "./dto/search-users-query.dto";
import { UserProfileParams } from "./dto/user-profile-params.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("search")
  search(
    @Session() session: UserSession<DramaWatchAuth>,
    @Query() query: SearchUsersQuery,
  ): Promise<PublicUserProfileResponse[]> {
    return this.usersService.search(
      session.user.id,
      query.q,
      query.limit,
    );
  }

  @Get(":username")
  @AllowAnonymous()
  getByUsername(
    @Param() params: UserProfileParams,
  ): Promise<PublicUserProfileResponse> {
    return this.usersService.getByUsername(params.username);
  }
}
