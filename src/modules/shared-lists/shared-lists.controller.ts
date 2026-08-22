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
} from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import {
  type SharedListDetailsResponse,
  type SharedListInviteResponse,
  type SharedListItemResponse,
  type SharedListResponse,
} from "../../common/types/shared-list.types";
import { AddSharedListItemDto } from "./dto/add-shared-list-item.dto";
import { CreateSharedListInviteDto } from "./dto/create-shared-list-invite.dto";
import { CreateSharedListDto } from "./dto/create-shared-list.dto";
import { ReorderSharedListItemsDto } from "./dto/reorder-shared-list-items.dto";
import {
  SharedListInviteParamsDto,
  SharedListItemParamsDto,
  SharedListParamsDto,
} from "./dto/shared-list-params.dto";
import { UpdateSharedListItemDto } from "./dto/update-shared-list-item.dto";
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

  @Post(":token/accept")
  accept(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SharedListInviteParamsDto,
  ): Promise<SharedListDetailsResponse> {
    return this.service.acceptInvite(session.user.id, params.token);
  }
}
