import { Inject, Injectable } from "@nestjs/common";
import {
  type Model,
  type PipelineStage,
  Types,
} from "mongoose";

import { type WatchStatus } from "../../common/types/library.types";
import { type MediaType } from "../../common/types/media.types";
import { PublicLibrarySort } from "../../common/types/public-library.types";
import { USER_MEDIA_MODEL } from "../library/user-media-model.provider";
import { type UserMediaDocument } from "../library/schema/user-media.schema";
import { type MediaDocument } from "../media/schema/media.schema";

export interface PublicLibraryFilters {
  status?: WatchStatus;
  mediaType?: MediaType;
  minRating?: number;
  genreId?: number;
  country?: string;
  yearFrom?: number;
  yearTo?: number;
  sort: PublicLibrarySort;
  page: number;
  limit: number;
}

export interface StoredPublicLibraryItem {
  status: WatchStatus;
  rating?: number;
  media: MediaDocument;
}

export interface StoredPublicLibraryPage {
  items: StoredPublicLibraryItem[];
  totalResults: number;
}

interface PublicLibraryFacet {
  items: StoredPublicLibraryItem[];
  total: Array<{ count: number }>;
}

@Injectable()
export class PublicLibraryRepository {
  constructor(
    @Inject(USER_MEDIA_MODEL)
    private readonly userMediaModel: Model<UserMediaDocument>,
  ) {}

  async findPage(
    userId: Types.ObjectId,
    filters: PublicLibraryFilters,
  ): Promise<StoredPublicLibraryPage> {
    const userMediaMatch: Record<string, unknown> = { userId };

    if (filters.status !== undefined) {
      userMediaMatch["status"] = filters.status;
    }

    if (filters.minRating !== undefined) {
      userMediaMatch["rating"] = { $gte: filters.minRating };
    }

    const mediaMatch = buildMediaMatch(filters);
    const pipeline: PipelineStage[] = [
      { $match: userMediaMatch },
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
        $set: {
          publicLibraryReleaseDate: {
            $ifNull: [
              "$media.firstAirDate",
              "$media.releaseDate",
              "",
            ],
          },
          publicLibraryReleaseDateAscending: {
            $ifNull: [
              "$media.firstAirDate",
              "$media.releaseDate",
              "9999-12-31",
            ],
          },
          publicLibraryTitle: { $toLower: "$media.title" },
        },
      },
      ...(Object.keys(mediaMatch).length === 0
        ? []
        : [{ $match: mediaMatch }]),
      { $sort: buildSort(filters.sort) },
      {
        $facet: {
          items: [
            { $skip: (filters.page - 1) * filters.limit },
            { $limit: filters.limit },
            {
              $project: {
                _id: 0,
                status: 1,
                rating: 1,
                media: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];
    const [result] =
      await this.userMediaModel.aggregate<PublicLibraryFacet>(
        pipeline,
      );

    return {
      items: result?.items ?? [],
      totalResults: result?.total[0]?.count ?? 0,
    };
  }
}

function buildMediaMatch(
  filters: PublicLibraryFilters,
): Record<string, unknown> {
  const match: Record<string, unknown> = {};

  if (filters.mediaType !== undefined) {
    match["media.mediaType"] = filters.mediaType;
  }

  if (filters.genreId !== undefined) {
    match["media.genreIds"] = filters.genreId;
  }

  if (filters.country !== undefined) {
    match["media.originCountry"] = filters.country;
  }

  if (
    filters.yearFrom !== undefined ||
    filters.yearTo !== undefined
  ) {
    match["publicLibraryReleaseDate"] = {
      ...(filters.yearFrom === undefined
        ? {}
        : { $gte: `${filters.yearFrom}-01-01` }),
      ...(filters.yearTo === undefined
        ? {}
        : { $lte: `${filters.yearTo}-12-31` }),
    };
  }

  return match;
}

function buildSort(
  sort: PublicLibrarySort,
): Record<string, 1 | -1> {
  switch (sort) {
    case PublicLibrarySort.TitleAscending:
      return { publicLibraryTitle: 1, _id: 1 };
    case PublicLibrarySort.TitleDescending:
      return { publicLibraryTitle: -1, _id: 1 };
    case PublicLibrarySort.RatingDescending:
      return { rating: -1, updatedAt: -1, _id: 1 };
    case PublicLibrarySort.ReleaseDateDescending:
      return {
        publicLibraryReleaseDate: -1,
        publicLibraryTitle: 1,
        _id: 1,
      };
    case PublicLibrarySort.ReleaseDateAscending:
      return {
        publicLibraryReleaseDateAscending: 1,
        publicLibraryTitle: 1,
        _id: 1,
      };
    case PublicLibrarySort.RecentlyUpdated:
      return { updatedAt: -1, _id: 1 };
  }
}
