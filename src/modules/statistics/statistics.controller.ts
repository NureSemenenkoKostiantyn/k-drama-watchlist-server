import { Controller, Get, Query } from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type StatisticsOverviewResponse } from "../../common/types/statistics.types";
import { StatisticsQueryDto } from "./dto/statistics-query.dto";
import { StatisticsService } from "./statistics.service";

@Controller("statistics")
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  getOverview(
    @Session() session: UserSession<DramaWatchAuth>,
    @Query() query: StatisticsQueryDto,
  ): Promise<StatisticsOverviewResponse> {
    return this.statisticsService.getOverview(session.user.id, query.statuses);
  }
}
