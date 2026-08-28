import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
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
  PUBLIC_DISCOVERY_CACHE_CONTROL,
  setShareableResourceCacheControl,
} from "../../common/http/cache-control";
import {
  type PublicSharedListDetailsResponse,
  type PublicSharedListDiscoveryResponse,
  type SharedListDetailsResponse,
  type SharedListInviteResponse,
  type SharedListPendingInviteResponse,
  type SharedListItemResponse,
  type SharedListMemberResponse,
  type SharedListResponse,
} from "../../common/types/shared-list.types";
import { OpenGraphService } from "../open-graph/open-graph.service";
import { AddSharedListItemDto } from "./dto/add-shared-list-item.dto";
import { CreateSharedListInviteDto } from "./dto/create-shared-list-invite.dto";
import { CreateSharedListDto } from "./dto/create-shared-list.dto";
import { ReorderSharedListItemsDto } from "./dto/reorder-shared-list-items.dto";
import { PublicSharedListsQueryDto } from "./dto/public-shared-lists-query.dto";
import {
  SharedListInviteParamsDto,
  SharedListItemParamsDto,
  SharedListMemberParamsDto,
  SharedListPendingInviteParamsDto,
  SharedListParamsDto,
  PublicSharedListParamsDto,
} from "./dto/shared-list-params.dto";
import { UpdateSharedListItemDto } from "./dto/update-shared-list-item.dto";
import { UpdateSharedListMemberDto } from "./dto/update-shared-list-member.dto";
import { UpdateSharedListDto } from "./dto/update-shared-list.dto";
import { SharedListsService } from "./shared-lists.service";

@Controller("lists")
export class SharedListsController {
  constructor(private readonly service: SharedListsService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<SharedListResponse[]> {
    return this.service.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreateSharedListDto,
  ): Promise<SharedListDetailsResponse> {
    return this.service.create(session.user.id, input);
  }

  @Post(":listId/invites")
  createInvite(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
    @Body() input: CreateSharedListInviteDto,
  ): Promise<SharedListInviteResponse> {
    return this.service.createInvite(session.user.id, params.listId, input);
  }

  @Get(":listId/invites")
  listInvites(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
  ): Promise<SharedListPendingInviteResponse[]> {
    return this.service.listInvites(session.user.id, params.listId);
  }

  @Delete(":listId/invites/:inviteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvite(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListPendingInviteParamsDto,
  ): Promise<void> {
    return this.service.revokeInvite(
      session.user.id,
      params.listId,
      params.inviteId,
    );
  }

  @Patch(":listId/members/:memberUserId")
  updateMember(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListMemberParamsDto,
    @Body() input: UpdateSharedListMemberDto,
  ): Promise<SharedListMemberResponse> {
    return this.service.updateMember(
      session.user.id,
      params.listId,
      params.memberUserId,
      input,
    );
  }

  @Delete(":listId/members/:memberUserId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListMemberParamsDto,
  ): Promise<void> {
    return this.service.removeMember(
      session.user.id,
      params.listId,
      params.memberUserId,
    );
  }

  @Post(":listId/items")
  addItem(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
    @Body() input: AddSharedListItemDto,
  ): Promise<SharedListItemResponse> {
    return this.service.addItem(session.user.id, params.listId, input);
  }

  @Patch(":listId/items/:itemId")
  updateItem(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListItemParamsDto,
    @Body() input: UpdateSharedListItemDto,
  ): Promise<SharedListItemResponse> {
    return this.service.updateItem(
      session.user.id,
      params.listId,
      params.itemId,
      input,
    );
  }

  @Delete(":listId/items/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListItemParamsDto,
  ): Promise<void> {
    return this.service.deleteItem(
      session.user.id,
      params.listId,
      params.itemId,
    );
  }

  @Post(":listId/reorder")
  reorderItems(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
    @Body() input: ReorderSharedListItemsDto,
  ): Promise<SharedListItemResponse[]> {
    return this.service.reorderItems(session.user.id, params.listId, input);
  }

  @Get(":listId")
  get(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
  ): Promise<SharedListDetailsResponse> {
    return this.service.get(session.user.id, params.listId);
  }

  @Patch(":listId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
    @Body() input: UpdateSharedListDto,
  ): Promise<SharedListDetailsResponse> {
    return this.service.update(session.user.id, params.listId, input);
  }

  @Delete(":listId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListParamsDto,
  ): Promise<void> {
    return this.service.delete(session.user.id, params.listId);
  }
}

@Controller("list-invites")
export class SharedListInvitesController {
  constructor(private readonly service: SharedListsService) {}

  @Post(":identifier/accept")
  accept(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListInviteParamsDto,
  ): Promise<SharedListDetailsResponse> {
    return this.service.acceptInvite(session.user.id, params.identifier);
  }
}

@Controller("public/lists")
@AllowAnonymous()
export class PublicSharedListsController {
  constructor(
    private readonly service: SharedListsService,
    private readonly openGraphService: OpenGraphService,
  ) {}

  @Get()
  @Header("Cache-Control", PUBLIC_DISCOVERY_CACHE_CONTROL)
  list(
    @Query() query: PublicSharedListsQueryDto,
  ): Promise<PublicSharedListDiscoveryResponse> {
    return this.service.discoverPublic(query);
  }

  @Get("share/:publicSlug")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async share(
    @Param() params: PublicSharedListParamsDto,
  ): Promise<string> {
    const list = await this.service.getPublic(params.publicSlug);
    return this.openGraphService.renderSharedList(list);
  }

  @Get(":publicSlug")
  async get(
    @Param() params: PublicSharedListParamsDto,
    @Res({ passthrough: true }) response: CacheControlResponse,
  ): Promise<PublicSharedListDetailsResponse> {
    const list = await this.service.getPublic(params.publicSlug);
    setShareableResourceCacheControl(response, list.visibility);
    return list;
  }
}
