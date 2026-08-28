import { Inject, Injectable } from "@nestjs/common";
import {
  type Model,
  type PipelineStage,
  Types,
} from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import {
  type StatisticsCountryBucket,
  type StatisticsGenreBucket,
  type StatisticsRatingBucket,
  type StatisticsTotals,
} from "../../common/types/statistics.types";
import { USER_MEDIA_MODEL } from "../library/user-media-model.provider";
import { type UserMediaDocument } from "../library/schema/user-media.schema";

interface StatisticsOverviewAggregate extends StatisticsTotals {
  _id: null;
}

interface StatisticsBucketAggregate {
  _id: number | string;
  count: number;
}

interface StatisticsAggregateResult {
  overview: StatisticsOverviewAggregate[];
  ratingDistribution: StatisticsBucketAggregate[];
  topGenres: StatisticsBucketAggregate[];
  topCountries: StatisticsBucketAggregate[];
  completedByMonth: StatisticsBucketAggregate[];
}

export interface StoredStatisticsOverview {
  totals: StatisticsTotals;
  ratingDistribution: StatisticsRatingBucket[];
  topGenres: StatisticsGenreBucket[];
  topCountries: StatisticsCountryBucket[];
  completedByMonth: Array<{ month: string; count: number }>;
}

@Injectable()
export class StatisticsRepository {
  constructor(
    @Inject(USER_MEDIA_MODEL)
    private readonly userMediaModel: Model<UserMediaDocument>,
  ) {}

  async getOverview(
    userId: Types.ObjectId,
    completedSince: Date,
    completedUntil: Date,
    statuses: WatchStatus[],
  ): Promise<StoredStatisticsOverview> {
    const pipeline: PipelineStage[] = [
      { $match: { userId, status: { $in: statuses } } },
      {
        $lookup: {
          from: "media",
          localField: "mediaId",
          foreignField: "_id",
          as: "media",
        },
      },
      { $unwind: "$media" },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                library: { $sum: 1 },
                toWatch: {
                  $sum: {
                    $cond: [
                      { $eq: ["$status", WatchStatus.ToWatch] },
                      1,
                      0,
                    ],
                  },
                },
                watching: {
                  $sum: {
                    $cond: [
                      { $eq: ["$status", WatchStatus.Watching] },
                      1,
                      0,
                    ],
                  },
                },
                watched: {
                  $sum: {
                    $cond: [
                      { $eq: ["$status", WatchStatus.Watched] },
                      1,
                      0,
                    ],
                  },
                },
                movies: {
                  $sum: {
                    $cond: [
                      { $eq: ["$media.mediaType", MediaType.Movie] },
                      1,
                      0,
                    ],
                  },
                },
                tv: {
                  $sum: {
                    $cond: [
                      { $eq: ["$media.mediaType", MediaType.Tv] },
                      1,
                      0,
                    ],
                  },
                },
                rated: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $type: "$rating" }, "missing"] },
                      1,
                      0,
                    ],
                  },
                },
                completedEpisodes: {
                  $sum: { $ifNull: ["$progress.completedEpisodes", 0] },
                },
                averageRating: { $avg: "$rating" },
              },
            },
          ],
          ratingDistribution: [
            { $match: { rating: { $type: "number" } } },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          topGenres: [
            { $unwind: "$media.genreIds" },
            {
              $group: {
                _id: "$media.genreIds",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 5 },
          ],
          topCountries: [
            { $unwind: "$media.originCountry" },
            {
              $group: {
                _id: "$media.originCountry",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 5 },
          ],
          completedByMonth: [
            {
              $match: {
                completedAt: {
                  $gte: completedSince,
                  $lte: completedUntil,
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: "$completedAt",
                    format: "%Y-%m",
                    timezone: "UTC",
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];
    const [result] = await this.userMediaModel
      .aggregate<StatisticsAggregateResult>(pipeline)
      .exec();

    return mapAggregate(result);
  }
}

function mapAggregate(
  result: StatisticsAggregateResult | undefined,
): StoredStatisticsOverview {
  const totals = result?.overview[0];
  return {
    totals: totals
      ? {
          library: totals.library,
          toWatch: totals.toWatch,
          watching: totals.watching,
          watched: totals.watched,
          movies: totals.movies,
          tv: totals.tv,
          rated: totals.rated,
          completedEpisodes: totals.completedEpisodes,
          ...(totals.averageRating === undefined || totals.averageRating === null
            ? {}
            : { averageRating: totals.averageRating }),
        }
      : emptyTotals(),
    ratingDistribution: (result?.ratingDistribution ?? []).map(
      (bucket) => ({ rating: Number(bucket._id), count: bucket.count }),
    ),
    topGenres: (result?.topGenres ?? []).map((bucket) => ({
      genreId: Number(bucket._id),
      count: bucket.count,
    })),
    topCountries: (result?.topCountries ?? []).map((bucket) => ({
      countryCode: String(bucket._id),
      count: bucket.count,
    })),
    completedByMonth: (result?.completedByMonth ?? []).map((bucket) => ({
      month: String(bucket._id),
      count: bucket.count,
    })),
  };
}

function emptyTotals(): StatisticsTotals {
  return {
    library: 0,
    toWatch: 0,
    watching: 0,
    watched: 0,
    movies: 0,
    tv: 0,
    rated: 0,
    completedEpisodes: 0,
  };
}
