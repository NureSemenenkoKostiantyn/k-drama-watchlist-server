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
import {
  type PublicWheelDetailsResponse,
  type WheelDetailsResponse,
  type WheelItemResponse,
  type WheelMemberResponse,
  type WheelResponse,
  type WheelSpinHistoryResponse,
  type WheelSpinResponse,
} from "../../common/types/wheel.types";
import { OpenGraphService } from "../open-graph/open-graph.service";
import { AddWheelItemDto } from "./dto/add-wheel-item.dto";
import { AddWheelMemberDto } from "./dto/add-wheel-member.dto";
import { CreateWheelDto } from "./dto/create-wheel.dto";
import { ReorderWheelItemsDto } from "./dto/reorder-wheel-items.dto";
import { UpdateWheelItemDto } from "./dto/update-wheel-item.dto";
import { UpdateWheelMemberDto } from "./dto/update-wheel-member.dto";
import { UpdateWheelDto } from "./dto/update-wheel.dto";
import {
  PublicWheelParamsDto,
  WheelItemParamsDto,
  WheelMemberParamsDto,
  WheelParamsDto,
} from "./dto/wheel-params.dto";
import { WheelsService } from "./wheels.service";

@Controller("wheels")
export class WheelsController {
  constructor(private readonly wheelsService: WheelsService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<WheelResponse[]> {
    return this.wheelsService.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreateWheelDto,
  ): Promise<WheelDetailsResponse> {
    return this.wheelsService.create(session.user.id, input);
  }

  @Get(":wheelId/history")
  history(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
  ): Promise<WheelSpinHistoryResponse[]> {
    return this.wheelsService.history(
      session.user.id,
      params.wheelId,
    );
  }

  @Post(":wheelId/reset-history")
  @HttpCode(HttpStatus.NO_CONTENT)
  resetHistory(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
  ): Promise<void> {
    return this.wheelsService.resetHistory(
      session.user.id,
      params.wheelId,
    );
  }

  @Post(":wheelId/spin")
  spin(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
  ): Promise<WheelSpinResponse> {
    return this.wheelsService.spin(session.user.id, params.wheelId);
  }

  @Post(":wheelId/members")
  addMember(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
    @Body() input: AddWheelMemberDto,
  ): Promise<WheelMemberResponse> {
    return this.wheelsService.addMember(
      session.user.id,
      params.wheelId,
      input,
    );
  }

  @Patch(":wheelId/members/:memberUserId")
  updateMember(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelMemberParamsDto,
    @Body() input: UpdateWheelMemberDto,
  ): Promise<WheelMemberResponse> {
    return this.wheelsService.updateMember(
      session.user.id,
      params.wheelId,
      params.memberUserId,
      input,
    );
  }

  @Delete(":wheelId/members/:memberUserId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelMemberParamsDto,
  ): Promise<void> {
    return this.wheelsService.removeMember(
      session.user.id,
      params.wheelId,
      params.memberUserId,
    );
  }

  @Post(":wheelId/items")
  addItem(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
    @Body() input: AddWheelItemDto,
  ): Promise<WheelItemResponse> {
    return this.wheelsService.addItem(
      session.user.id,
      params.wheelId,
      input,
    );
  }

  @Patch(":wheelId/items/:itemId")
  updateItem(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelItemParamsDto,
    @Body() input: UpdateWheelItemDto,
  ): Promise<WheelItemResponse> {
    return this.wheelsService.updateItem(
      session.user.id,
      params.wheelId,
      params.itemId,
      input,
    );
  }

  @Delete(":wheelId/items/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelItemParamsDto,
  ): Promise<void> {
    return this.wheelsService.deleteItem(
      session.user.id,
      params.wheelId,
      params.itemId,
    );
  }

  @Post(":wheelId/reorder")
  reorderItems(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
    @Body() input: ReorderWheelItemsDto,
  ): Promise<WheelItemResponse[]> {
    return this.wheelsService.reorderItems(
      session.user.id,
      params.wheelId,
      input,
    );
  }

  @Get(":wheelId")
  get(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
  ): Promise<WheelDetailsResponse> {
    return this.wheelsService.get(session.user.id, params.wheelId);
  }

  @Patch(":wheelId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
    @Body() input: UpdateWheelDto,
  ): Promise<WheelDetailsResponse> {
    return this.wheelsService.update(
      session.user.id,
      params.wheelId,
      input,
    );
  }

  @Delete(":wheelId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: WheelParamsDto,
  ): Promise<void> {
    return this.wheelsService.delete(session.user.id, params.wheelId);
  }
}

@Controller("public/wheels")
@AllowAnonymous()
export class PublicWheelsController {
  constructor(
    private readonly wheelsService: WheelsService,
    private readonly openGraphService: OpenGraphService,
  ) {}

  @Get("share/:publicSlug")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async share(@Param() params: PublicWheelParamsDto): Promise<string> {
    const wheel = await this.wheelsService.getPublic(params.publicSlug);
    return this.openGraphService.renderWheel(wheel);
  }

  @Get(":publicSlug")
  async get(
    @Param() params: PublicWheelParamsDto,
    @Res({ passthrough: true }) response: CacheControlResponse,
  ): Promise<PublicWheelDetailsResponse> {
    const wheel = await this.wheelsService.getPublic(params.publicSlug);
    setShareableResourceCacheControl(response, wheel.visibility);
    return wheel;
  }
}
