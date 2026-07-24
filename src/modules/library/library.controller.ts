import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type LibraryEntryResponse } from "../../common/types/library.types";
import { AddLibraryEntryDto } from "./dto/add-library-entry.dto";
import { LibraryEntryParams } from "./dto/library-entry-params.dto";
import { ListLibraryQuery } from "./dto/list-library-query.dto";
import { UpdateLibraryStatusDto } from "./dto/update-library-status.dto";
import { LibraryService } from "./library.service";

@Controller("library")
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
    @Query() query: ListLibraryQuery,
  ): Promise<LibraryEntryResponse[]> {
    return this.libraryService.list(session.user.id, query.status);
  }

  @Post()
  add(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: AddLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.add(session.user.id, input);
  }

  @Get(":entryId")
  get(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.get(session.user.id, params.entryId);
  }

  @Patch(":entryId/status")
  updateStatus(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdateLibraryStatusDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.updateStatus(
      session.user.id,
      params.entryId,
      input.status,
    );
  }

  @Delete(":entryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
  ): Promise<void> {
    return this.libraryService.delete(session.user.id, params.entryId);
  }
}
