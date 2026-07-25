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
  type WheelDetailsResponse,
  type WheelItemResponse,
  type WheelResponse,
  type WheelSpinHistoryResponse,
  type WheelSpinResponse,
} from "../../common/types/wheel.types";
import { AddWheelItemDto } from "./dto/add-wheel-item.dto";
import { CreateWheelDto } from "./dto/create-wheel.dto";
import { ReorderWheelItemsDto } from "./dto/reorder-wheel-items.dto";
import { UpdateWheelItemDto } from "./dto/update-wheel-item.dto";
import { UpdateWheelDto } from "./dto/update-wheel.dto";
import {
  WheelItemParamsDto,
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
