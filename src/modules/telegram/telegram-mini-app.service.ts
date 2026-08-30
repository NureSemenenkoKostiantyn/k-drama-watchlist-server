import { Injectable } from "@nestjs/common";

import { type LibraryEntryResponse, type WatchStatus } from "../../common/types/library.types";
import { type MediaSearchResponse } from "../../common/types/media.types";
import { LibraryService } from "../library/library.service";
import { type AddLibraryEntryDto } from "../library/dto/add-library-entry.dto";
import { type UpdateProgressDto } from "../library/dto/update-progress.dto";
import { type SearchMediaQuery } from "../media/dto/search-media-query.dto";
import { MediaService } from "../media/media.service";
import { TelegramMiniAppAuthService } from "./telegram-mini-app-auth.service";

@Injectable()
export class TelegramMiniAppService {
  constructor(
    private readonly authService: TelegramMiniAppAuthService,
    private readonly mediaService: MediaService,
    private readonly libraryService: LibraryService,
  ) {}

  async search(
    initData: string | undefined,
    query: SearchMediaQuery,
  ): Promise<MediaSearchResponse> {
    await this.authService.resolveUserId(initData);
    return this.mediaService.search(query);
  }

  async listLibrary(
    initData: string | undefined,
    status?: WatchStatus,
  ): Promise<LibraryEntryResponse[]> {
    return this.libraryService.list(
      await this.authService.resolveUserId(initData),
      status,
    );
  }

  async addToLibrary(
    initData: string | undefined,
    input: AddLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.add(
      await this.authService.resolveUserId(initData),
      input,
    );
  }

  async updateStatus(
    initData: string | undefined,
    entryId: string,
    status: WatchStatus,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.updateStatus(
      await this.authService.resolveUserId(initData),
      entryId,
      status,
    );
  }

  async updateProgress(
    initData: string | undefined,
    entryId: string,
    input: UpdateProgressDto,
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.updateProgress(
      await this.authService.resolveUserId(initData),
      entryId,
      input,
    );
  }
}
