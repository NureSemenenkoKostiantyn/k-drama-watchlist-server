import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../common/errors/api-exception";
import {
  type MediaDetails,
  type MediaSearchResponse,
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";
import { TmdbClient } from "../../integrations/tmdb/tmdb.client";
import {
  normalizeTmdbMediaDetails,
  normalizeTmdbSearchResponse,
} from "../../integrations/tmdb/tmdb.normalizer";
import { type SearchMediaQuery } from "./dto/search-media-query.dto";

@Injectable()
export class MediaService {
  constructor(private readonly tmdbClient: TmdbClient) {}

  async search(query: SearchMediaQuery): Promise<MediaSearchResponse> {
    if (
      query.country !== undefined &&
      query.type !== SearchMediaType.Tv
    ) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: "VALIDATION_ERROR",
        message: "The country filter is available for TV searches.",
      });
    }

    const response = normalizeTmdbSearchResponse(
      await this.tmdbClient.search({
        page: query.page,
        query: query.q,
        type: query.type,
      }),
      query.type,
    );

    if (query.country === undefined) {
      return response;
    }

    return {
      ...response,
      results: response.results.filter((result) =>
        result.originCountry.includes(query.country as string),
      ),
    };
  }

  async getDetails(
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<MediaDetails> {
    return normalizeTmdbMediaDetails(
      await this.tmdbClient.getDetails(mediaType, tmdbId),
      mediaType,
    );
  }
}
