import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import {
  type CacheControlResponse,
  setShareableResourceCacheControl,
} from "../../common/http/cache-control";
import { OpenGraphService } from "../open-graph/open-graph.service";
import {
  AddTierItemsDto,
  CreateTierListDto,
  PublicTierListParamsDto,
  RemoveTierItemDto,
  RevisionDto,
  TierListParamsDto,
  UpdateTierLayoutDto,
  UpdateTierListDto,
} from "./dto/tier-list.dto";
import { TierListsService } from "./tier-lists.service";

@Controller("tier-lists")
export class TierListsController {
  constructor(private readonly service: TierListsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@Session() session: UserSession<DramaWatchAuth>) {
    return this.service.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreateTierListDto,
  ) {
    return this.service.create(session.user.id, input);
  }

  @Get(":tierListId")
  @Header("Cache-Control", "private, no-store")
  get(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
  ) {
    return this.service.get(session.user.id, params.tierListId);
  }

  @Patch(":tierListId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
    @Body() input: UpdateTierListDto,
  ) {
    return this.service.update(session.user.id, params.tierListId, input);
  }

  @Patch(":tierListId/layout")
  layout(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
    @Body() input: UpdateTierLayoutDto,
  ) {
    return this.service.layout(session.user.id, params.tierListId, input);
  }

  @Post(":tierListId/items")
  @HttpCode(200)
  add(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
    @Body() input: AddTierItemsDto,
  ) {
    return this.service.add(session.user.id, params.tierListId, input);
  }

  @Post(":tierListId/remove-item")
  @HttpCode(200)
  remove(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
    @Body() input: RemoveTierItemDto,
  ) {
    return this.service.remove(session.user.id, params.tierListId, input);
  }

  @Post(":tierListId/duplicate")
  duplicate(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
    @Body() input: RevisionDto,
  ) {
    return this.service.duplicate(
      session.user.id,
      params.tierListId,
      input.revision,
    );
  }

  @Delete(":tierListId")
  @HttpCode(204)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: TierListParamsDto,
    @Query() input: RevisionDto,
  ) {
    return this.service.delete(
      session.user.id,
      params.tierListId,
      input.revision,
    );
  }
}

@Controller("public/tier-lists")
@AllowAnonymous()
export class PublicTierListsController {
  constructor(
    private readonly service: TierListsService,
    private readonly openGraph: OpenGraphService,
  ) {}

  @Get("share/:publicSlug")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async share(@Param() params: PublicTierListParamsDto) {
    return this.openGraph.renderTierList(
      await this.service.getPublic(params.publicSlug),
    );
  }

  @Get(":publicSlug")
  @Header("Cache-Control", "private, no-store")
  async get(
    @Param() params: PublicTierListParamsDto,
    @Res({ passthrough: true }) response: CacheControlResponse,
  ) {
    const board = await this.service.getPublic(params.publicSlug);
    setShareableResourceCacheControl(response, board.visibility);
    return board;
  }
}
