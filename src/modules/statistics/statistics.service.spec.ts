import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  type StatisticsRepository,
  type StoredStatisticsOverview,
} from "./statistics.repository";
import { WatchStatus } from "../../common/types/library.types";
import { StatisticsService } from "./statistics.service";

describe("StatisticsService", () => {
  const userId = new Types.ObjectId();
  const getOverview = jest.fn<StatisticsRepository["getOverview"]>();
  const service = new StatisticsService({
    getOverview,
  } as unknown as StatisticsRepository);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    getOverview.mockResolvedValue(buildStoredOverview());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("returns exact owner statistics and fills empty completion months", async () => {
    const response = await service.getOverview(userId.toHexString());

    expect(getOverview).toHaveBeenCalledWith(
      userId,
      new Date("2025-09-01T00:00:00.000Z"),
      new Date("2026-08-23T12:00:00.000Z"),
      [WatchStatus.Watching, WatchStatus.Watched],
    );
    expect(response.totals.averageRating).toBe(8.67);
    expect(response.completedByMonth).toHaveLength(12);
    expect(response.completedByMonth[0]).toEqual({
      month: "2025-09",
      count: 0,
    });
    expect(response.completedByMonth.at(-1)).toEqual({
      month: "2026-08",
      count: 2,
    });
  });

  it("passes an explicitly selected status scope to the repository", async () => {
    await service.getOverview(userId.toHexString(), [WatchStatus.ToWatch]);

    expect(getOverview).toHaveBeenCalledWith(
      userId,
      new Date("2025-09-01T00:00:00.000Z"),
      new Date("2026-08-23T12:00:00.000Z"),
      [WatchStatus.ToWatch],
    );
  });

  function buildStoredOverview(): StoredStatisticsOverview {
    return {
      totals: {
        library: 8,
        toWatch: 3,
        watching: 2,
        watched: 3,
        movies: 2,
        tv: 6,
        rated: 3,
        completedEpisodes: 24,
        averageRating: 8.666,
      },
      ratingDistribution: [
        { rating: 8, count: 1 },
        { rating: 9, count: 2 },
      ],
      topGenres: [{ genreId: 18, count: 6 }],
      topCountries: [{ countryCode: "KR", count: 7 }],
      completedByMonth: [
        { month: "2026-06", count: 1 },
        { month: "2026-08", count: 2 },
      ],
    };
  }
});
