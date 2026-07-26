import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type PublicLibraryResponse } from "../../common/types/public-library.types";
import { UserProfileParams } from "../users/dto/user-profile-params.dto";
import { PublicLibraryQuery } from "./dto/public-library-query.dto";
import { PublicLibraryService } from "./public-library.service";

@Controller("users")
export class PublicLibraryController {
  constructor(
    private readonly publicLibraryService: PublicLibraryService,
  ) {}

  @Get(":username/library")
  @OptionalAuth()
  getByUsername(
    @Session()
    session: UserSession<DramaWatchAuth> | null | undefined,
    @Param() params: UserProfileParams,
    @Query() query: PublicLibraryQuery,
  ): Promise<PublicLibraryResponse> {
    return this.publicLibraryService.getByUsername(
      session?.user.id,
      params.username,
      query,
    );
  }
}
