import { Controller, Get } from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type StatisticsOverviewResponse } from "../../common/types/statistics.types";
import { StatisticsService } from "./statistics.service";

@Controller("statistics")
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  getOverview(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<StatisticsOverviewResponse> {
    return this.statisticsService.getOverview(session.user.id);
  }
}
