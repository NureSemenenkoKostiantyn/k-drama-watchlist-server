import { Controller, Get, Query } from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type ActivityFeedResponse } from "../../common/types/activity.types";
import { ActivityService } from "./activity.service";
import { ActivityFeedQueryDto } from "./dto/activity-feed-query.dto";

@Controller("activity")
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<ActivityFeedResponse> {
    return this.activityService.list(session.user.id, query);
  }
}
