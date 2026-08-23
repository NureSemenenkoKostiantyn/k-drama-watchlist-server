import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type PublicLibraryResponse } from "../../common/types/public-library.types";
import { UserIdParams } from "../users/dto/user-id-params.dto";
import { PublicLibraryQuery } from "./dto/public-library-query.dto";
import { PublicLibraryService } from "./public-library.service";

@Controller("users")
export class PublicLibraryController {
  constructor(
    private readonly publicLibraryService: PublicLibraryService,
  ) {}

  @Get(":userId/library")
  @OptionalAuth()
  getByUserId(
    @Session()
    session: UserSession<DramaWatchAuth> | null | undefined,
    @Param() params: UserIdParams,
    @Query() query: PublicLibraryQuery,
  ): Promise<PublicLibraryResponse> {
    return this.publicLibraryService.getByUserId(
      session?.user.id,
      params.userId,
      query,
    );
  }
}
