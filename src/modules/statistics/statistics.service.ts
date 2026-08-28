import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { type StatisticsOverviewResponse } from "../../common/types/statistics.types";
import { WatchStatus } from "../../common/types/library.types";
import {
  StatisticsRepository,
  type StoredStatisticsOverview,
} from "./statistics.repository";

const COMPLETION_MONTHS = 12;
const DEFAULT_STATUSES = [WatchStatus.Watching, WatchStatus.Watched];

@Injectable()
export class StatisticsService {
  constructor(
    private readonly statisticsRepository: StatisticsRepository,
  ) {}

  async getOverview(
    authenticatedUserId: string,
    statuses: WatchStatus[] = DEFAULT_STATUSES,
  ): Promise<StatisticsOverviewResponse> {
    const now = new Date();
    const months = recentMonthKeys(now);
    const stored = await this.statisticsRepository.getOverview(
      toObjectId(authenticatedUserId),
      monthStart(months[0]),
      now,
      statuses,
    );
    return toResponse(stored, months);
  }
}

function toResponse(
  stored: StoredStatisticsOverview,
  months: string[],
): StatisticsOverviewResponse {
  const completedByMonth = new Map(
    stored.completedByMonth.map((bucket) => [bucket.month, bucket.count]),
  );
  return {
    totals: {
      ...stored.totals,
      ...(stored.totals.averageRating === undefined
        ? {}
        : {
            averageRating:
              Math.round(stored.totals.averageRating * 100) / 100,
          }),
    },
    ratingDistribution: stored.ratingDistribution,
    topGenres: stored.topGenres,
    topCountries: stored.topCountries,
    completedByMonth: months.map((month) => ({
      month,
      count: completedByMonth.get(month) ?? 0,
    })),
  };
}

function recentMonthKeys(now: Date): string[] {
  return Array.from({ length: COMPLETION_MONTHS }, (_, index) => {
    const month = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (COMPLETION_MONTHS - 1) + index,
        1,
      ),
    );
    return month.toISOString().slice(0, 7);
  });
}

function monthStart(month: string | undefined): Date {
  if (!month) throw new Error("Statistics month range is unavailable");
  return new Date(`${month}-01T00:00:00.000Z`);
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }
  return new Types.ObjectId(id);
}
