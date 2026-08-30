import {
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Body,
} from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type LibraryEntryResponse } from "../../common/types/library.types";
import { type MediaSearchResponse } from "../../common/types/media.types";
import {
  type TelegramConnectionResponse,
  type TelegramLinkResponse,
  type TelegramMiniAppSessionResponse,
} from "../../common/types/telegram.types";
import { TelegramLinkService } from "./telegram-link.service";
import { AddLibraryEntryDto } from "../library/dto/add-library-entry.dto";
import { LibraryEntryParams } from "../library/dto/library-entry-params.dto";
import { ListLibraryQuery } from "../library/dto/list-library-query.dto";
import { UpdateLibraryStatusDto } from "../library/dto/update-library-status.dto";
import { UpdateProgressDto } from "../library/dto/update-progress.dto";
import { SearchMediaQuery } from "../media/dto/search-media-query.dto";
import { TelegramMiniAppAuthService } from "./telegram-mini-app-auth.service";
import { TelegramMiniAppService } from "./telegram-mini-app.service";
import { TelegramUpdateService } from "./telegram-update.service";

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly linkService: TelegramLinkService,
    private readonly updateService: TelegramUpdateService,
    private readonly miniAppAuthService: TelegramMiniAppAuthService,
    private readonly miniAppService: TelegramMiniAppService,
  ) {}

  @Get("connection")
  @Header("Cache-Control", "no-store")
  getConnection(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<TelegramConnectionResponse> {
    return this.linkService.getConnection(session.user.id);
  }

  @Post("link")
  @Header("Cache-Control", "no-store")
  createLink(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<TelegramLinkResponse> {
    return this.linkService.createLink(session.user.id);
  }

  @Delete("connection")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<void> {
    return this.linkService.disconnect(session.user.id);
  }

  @Post("webhook")
  @AllowAnonymous()
  @HttpCode(HttpStatus.NO_CONTENT)
  webhook(
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Body() input: unknown,
  ): Promise<void> {
    return this.updateService.handle(secret, input);
  }

  @Post("mini-app/session")
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "private, no-store")
  authenticateMiniApp(
    @Headers("x-telegram-init-data") initData: string | undefined,
  ): Promise<TelegramMiniAppSessionResponse> {
    return this.miniAppAuthService.authenticate(initData);
  }

  @Get("mini-app/search")
  @AllowAnonymous()
  @Header("Cache-Control", "private, no-store")
  searchFromMiniApp(
    @Headers("x-telegram-init-data") initData: string | undefined,
    @Query() query: SearchMediaQuery,
  ): Promise<MediaSearchResponse> {
    return this.miniAppService.search(initData, query);
  }

  @Get("mini-app/library")
  @AllowAnonymous()
  @Header("Cache-Control", "private, no-store")
  listMiniAppLibrary(
    @Headers("x-telegram-init-data") initData: string | undefined,
    @Query() query: ListLibraryQuery,
  ): Promise<LibraryEntryResponse[]> {
    return this.miniAppService.listLibrary(initData, query.status);
  }

  @Post("mini-app/library")
  @AllowAnonymous()
  @Header("Cache-Control", "private, no-store")
  addFromMiniApp(
    @Headers("x-telegram-init-data") initData: string | undefined,
    @Body() input: AddLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    return this.miniAppService.addToLibrary(initData, input);
  }

  @Patch("mini-app/library/:entryId/status")
  @AllowAnonymous()
  @Header("Cache-Control", "private, no-store")
  updateMiniAppStatus(
    @Headers("x-telegram-init-data") initData: string | undefined,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdateLibraryStatusDto,
  ): Promise<LibraryEntryResponse> {
    return this.miniAppService.updateStatus(
      initData,
      params.entryId,
      input.status,
    );
  }

  @Patch("mini-app/library/:entryId/progress")
  @AllowAnonymous()
  @Header("Cache-Control", "private, no-store")
  updateMiniAppProgress(
    @Headers("x-telegram-init-data") initData: string | undefined,
    @Param() params: LibraryEntryParams,
    @Body() input: UpdateProgressDto,
  ): Promise<LibraryEntryResponse> {
    return this.miniAppService.updateProgress(initData, params.entryId, input);
  }
}
