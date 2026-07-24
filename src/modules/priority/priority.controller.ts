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
import { type PriorityLaneResponse } from "../../common/types/priority.types";
import { CreatePriorityLaneDto } from "./dto/create-priority-lane.dto";
import { PriorityLaneParams } from "./dto/priority-lane-params.dto";
import { ReorderPriorityBoardDto } from "./dto/reorder-priority-board.dto";
import { ReorderPriorityLanesDto } from "./dto/reorder-priority-lanes.dto";
import { UpdatePriorityLaneDto } from "./dto/update-priority-lane.dto";
import { PriorityService } from "./priority.service";

@Controller("priority-lanes")
export class PriorityController {
  constructor(private readonly priorityService: PriorityService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<PriorityLaneResponse[]> {
    return this.priorityService.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreatePriorityLaneDto,
  ): Promise<PriorityLaneResponse> {
    return this.priorityService.create(session.user.id, input);
  }

  @Patch(":laneId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: PriorityLaneParams,
    @Body() input: UpdatePriorityLaneDto,
  ): Promise<PriorityLaneResponse> {
    return this.priorityService.update(
      session.user.id,
      params.laneId,
      input,
    );
  }

  @Delete(":laneId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: PriorityLaneParams,
  ): Promise<void> {
    return this.priorityService.delete(
      session.user.id,
      params.laneId,
    );
  }

  @Post("reorder")
  reorderLanes(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: ReorderPriorityLanesDto,
  ): Promise<PriorityLaneResponse[]> {
    return this.priorityService.reorderLanes(
      session.user.id,
      input,
    );
  }

  @Post("reorder-items")
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderItems(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: ReorderPriorityBoardDto,
  ): Promise<void> {
    return this.priorityService.reorderItems(session.user.id, input);
  }
}
