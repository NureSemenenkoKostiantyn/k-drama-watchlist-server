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
import { UpdateLibraryEntryDto } from "./dto/update-library-entry.dto";
import { UpdatePlaybackPreferenceDto } from "./dto/update-playback-preference.dto";
import { UpdateProgressDto } from "./dto/update-progress.dto";
import { UpdateRatingDto } from "./dto/update-rating.dto";
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

  @Patch(":entryId/progress")
  updateProgress(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdateProgressDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.updateProgress(
      session.user.id,
      params.entryId,
      input,
    );
  }

  @Patch(":entryId/rating")
  updateRating(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdateRatingDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.updateRating(
      session.user.id,
      params.entryId,
      input.rating,
    );
  }

  @Patch(":entryId/playback-preference")
  updatePlaybackPreference(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdatePlaybackPreferenceDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.updatePlaybackPreference(
      session.user.id,
      params.entryId,
      input,
    );
  }

  @Patch(":entryId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdateLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.update(
      session.user.id,
      params.entryId,
      input,
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
