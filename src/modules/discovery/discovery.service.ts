import { Injectable } from "@nestjs/common";

import {
  type DiscoveryHomeResponse,
  type DiscoveryShelfResponse,
  DiscoveryShelfKey,
} from "../../common/types/discovery.types";
import {
  type MediaSummary,
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";
import {
  TmdbClient,
  type TmdbDiscoverRequest,
} from "../../integrations/tmdb/tmdb.client";
import { normalizeTmdbSearchResponse } from "../../integrations/tmdb/tmdb.normalizer";
import {
  DiscoveryCacheRepository,
  type StoredDiscoveryCache,
} from "./discovery-cache.repository";

const cacheFreshMilliseconds = 24 * 60 * 60 * 1_000;
const cacheRetentionMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const refreshLeaseMilliseconds = 30 * 1_000;
const shelfItemLimit = 12;

interface DiscoveryShelfDefinition {
  key: DiscoveryShelfKey;
  title: string;
  description: string;
  request: TmdbDiscoverRequest;
}

@Injectable()
export class DiscoveryService {
  private readonly inFlightRefreshes = new Map<
    DiscoveryShelfKey,
    Promise<MediaSummary[]>
  >();

  constructor(
    private readonly tmdbClient: TmdbClient,
    private readonly cacheRepository: DiscoveryCacheRepository,
  ) {}

  async getHome(): Promise<DiscoveryHomeResponse> {
    const definitions = createDiscoveryShelfDefinitions(new Date());
    const results = await Promise.allSettled(
      definitions.map((definition) => this.getShelf(definition)),
    );
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    const shelves = definitions.map((definition, index) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      items:
        results[index]?.status === "fulfilled"
          ? results[index].value
          : [],
    }));

    if (
      firstFailure !== undefined &&
      shelves.every((shelf) => shelf.items.length === 0)
    ) {
      throw firstFailure.reason;
    }

    const featured = findFeaturedMedia(shelves);
    return {
      ...(featured === undefined ? {} : { featured }),
      shelves,
    };
  }

  private async getShelf(
    definition: DiscoveryShelfDefinition,
  ): Promise<MediaSummary[]> {
    const now = new Date();
    const cached = await this.cacheRepository.findByKey(definition.key);

    if (cached && cached.freshUntil > now) {
      return cached.items;
    }

    const inFlight = this.inFlightRefreshes.get(definition.key);
    if (inFlight) {
      return cached?.items.length ? cached.items : inFlight;
    }

    const deleteAfter = addMilliseconds(
      now,
      cacheRetentionMilliseconds,
    );
    const ownsLease =
      await this.cacheRepository.tryAcquireRefreshLease(
        definition.key,
        now,
        addMilliseconds(now, refreshLeaseMilliseconds),
        deleteAfter,
      );

    if (!ownsLease && cached?.items.length) {
      return cached.items;
    }

    const refresh = this.refreshShelf(
      definition,
      cached,
      ownsLease,
      now,
      deleteAfter,
    );
    this.inFlightRefreshes.set(definition.key, refresh);

    try {
      return await refresh;
    } finally {
      this.inFlightRefreshes.delete(definition.key);
    }
  }

  private async refreshShelf(
    definition: DiscoveryShelfDefinition,
    cached: StoredDiscoveryCache | null,
    ownsLease: boolean,
    refreshedAt: Date,
    deleteAfter: Date,
  ): Promise<MediaSummary[]> {
    try {
      const requestedType =
        definition.request.mediaType === MediaType.Tv
          ? SearchMediaType.Tv
          : SearchMediaType.Movie;
      const response = normalizeTmdbSearchResponse(
        await this.tmdbClient.discover(definition.request),
        requestedType,
      );
      const items = response.results.slice(0, shelfItemLimit);

      await this.cacheRepository.store(definition.key, {
        items,
        refreshedAt,
        freshUntil: addMilliseconds(
          refreshedAt,
          cacheFreshMilliseconds,
        ),
        deleteAfter,
      });
      return items;
    } catch (error: unknown) {
      if (ownsLease) {
        await this.cacheRepository
          .releaseRefreshLease(definition.key)
          .catch(() => undefined);
      }

      if (cached?.items.length) {
        return cached.items;
      }

      throw error;
    }
  }
}

export function createDiscoveryShelfDefinitions(
  now: Date,
): DiscoveryShelfDefinition[] {
  const today = formatDate(now);
  const nextWeek = formatDate(addDays(now, 7));
  const recentStart = formatDate(addDays(now, -90));
  const koreanTvRequest = {
    mediaType: MediaType.Tv,
    originCountry: "KR",
  } as const;

  return [
    {
      key: DiscoveryShelfKey.PopularKdramas,
      title: "Popular K-dramas",
      description: "The Korean series drawing the biggest audience now.",
      request: {
        ...koreanTvRequest,
        sortBy: "popularity.desc",
      },
    },
    {
      key: DiscoveryShelfKey.AiringKdramas,
      title: "Currently airing",
      description: "Korean dramas with episodes arriving this week.",
      request: {
        ...koreanTvRequest,
        sortBy: "popularity.desc",
        airDateGte: today,
        airDateLte: nextWeek,
      },
    },
    {
      key: DiscoveryShelfKey.TopRatedKdramas,
      title: "Top-rated K-dramas",
      description: "Audience favourites with at least 200 TMDB votes.",
      request: {
        ...koreanTvRequest,
        sortBy: "vote_average.desc",
        voteCountGte: 200,
      },
    },
    {
      key: DiscoveryShelfKey.NewKdramas,
      title: "New K-drama releases",
      description: "Series that first aired within the last 90 days.",
      request: {
        ...koreanTvRequest,
        sortBy: "first_air_date.desc",
        firstAirDateGte: recentStart,
        firstAirDateLte: today,
      },
    },
    {
      key: DiscoveryShelfKey.PopularMovies,
      title: "Popular movies",
      description: "A wider look at films trending across TMDB.",
      request: {
        mediaType: MediaType.Movie,
        sortBy: "popularity.desc",
      },
    },
  ];
}

function findFeaturedMedia(
  shelves: DiscoveryShelfResponse[],
): MediaSummary | undefined {
  const allItems = shelves.flatMap((shelf) => shelf.items);
  return (
    allItems.find((item) => item.backdropUrl !== undefined) ??
    allItems[0]
  );
}

function addDays(date: Date, days: number): Date {
  return addMilliseconds(date, days * 24 * 60 * 60 * 1_000);
}

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
