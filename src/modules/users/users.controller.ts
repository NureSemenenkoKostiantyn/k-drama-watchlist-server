import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type PublicUserProfileResponse } from "../../common/types/user.types";
import { SearchUsersQuery } from "./dto/search-users-query.dto";
import { UserIdParams } from "./dto/user-id-params.dto";
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

  @Get(":userId")
  @AllowAnonymous()
  getById(
    @Param() params: UserIdParams,
  ): Promise<PublicUserProfileResponse> {
    return this.usersService.getById(params.userId);
  }
}
