import { HttpService } from "@nestjs/axios";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { isAxiosError } from "axios";
import { firstValueFrom } from "rxjs";

import { ApiException } from "../../common/errors/api-exception";
import {
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";

export interface TmdbSearchRequest {
  page: number;
  query: string;
  type: SearchMediaType;
}

export type TmdbDiscoverSort =
  | "first_air_date.desc"
  | "popularity.desc"
  | "vote_average.desc";

export interface TmdbDiscoverRequest {
  mediaType: MediaType;
  page?: number;
  sortBy: TmdbDiscoverSort;
  originCountry?: string;
  airDateGte?: string;
  airDateLte?: string;
  firstAirDateGte?: string;
  firstAirDateLte?: string;
  voteCountGte?: number;
}

@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);

  constructor(private readonly httpService: HttpService) {}

  search(request: TmdbSearchRequest): Promise<unknown> {
    const resource =
      request.type === SearchMediaType.All
        ? "multi"
        : request.type;

    return this.get(`/search/${resource}`, {
      include_adult: false,
      page: request.page,
      query: request.query,
    });
  }

  getDetails(mediaType: MediaType, tmdbId: number): Promise<unknown> {
    return this.get(`/${mediaType}/${tmdbId}`, {}, true);
  }

  discover(request: TmdbDiscoverRequest): Promise<unknown> {
    return this.get(`/discover/${request.mediaType}`, {
      include_adult: false,
      language: "en-US",
      page: request.page ?? 1,
      sort_by: request.sortBy,
      ...(request.originCountry === undefined
        ? {}
        : { with_origin_country: request.originCountry }),
      ...(request.airDateGte === undefined
        ? {}
        : { "air_date.gte": request.airDateGte }),
      ...(request.airDateLte === undefined
        ? {}
        : { "air_date.lte": request.airDateLte }),
      ...(request.firstAirDateGte === undefined
        ? {}
        : { "first_air_date.gte": request.firstAirDateGte }),
      ...(request.firstAirDateLte === undefined
        ? {}
        : { "first_air_date.lte": request.firstAirDateLte }),
      ...(request.voteCountGte === undefined
        ? {}
        : { "vote_count.gte": request.voteCountGte }),
    });
  }

  private async get(
    path: string,
    params: Record<string, boolean | number | string>,
    mapNotFound = false,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<unknown>(path, { params }),
      );

      return response.data;
    } catch (error: unknown) {
      const status = isAxiosError(error) ? error.response?.status : undefined;

      if (mapNotFound && status === HttpStatus.NOT_FOUND) {
        throw new ApiException({
          statusCode: HttpStatus.NOT_FOUND,
          code: "NOT_FOUND",
          message: "Media title not found.",
        });
      }

      this.logger.warn(
        `TMDB request failed for ${path} with status ${status ?? "unknown"}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        code: "TMDB_REQUEST_FAILED",
        message: "TMDB could not complete the request.",
      });
    }
  }
}
