import { jest } from "@jest/globals";

import { DiscoveryShelfKey } from "../../common/types/discovery.types";
import {
  type MediaSummary,
  MediaType,
} from "../../common/types/media.types";
import { type TmdbClient } from "../../integrations/tmdb/tmdb.client";
import {
  type DiscoveryCacheRepository,
  type StoredDiscoveryCache,
} from "./discovery-cache.repository";
import {
  createDiscoveryShelfDefinitions,
  DiscoveryService,
} from "./discovery.service";

describe("DiscoveryService", () => {
  const discover = jest.fn<TmdbClient["discover"]>();
  const findByKey =
    jest.fn<DiscoveryCacheRepository["findByKey"]>();
  const tryAcquireRefreshLease =
    jest.fn<DiscoveryCacheRepository["tryAcquireRefreshLease"]>();
  const store = jest.fn<DiscoveryCacheRepository["store"]>();
  const releaseRefreshLease =
    jest.fn<DiscoveryCacheRepository["releaseRefreshLease"]>();
  const service = new DiscoveryService(
    { discover } as unknown as TmdbClient,
    {
      findByKey,
      tryAcquireRefreshLease,
      store,
      releaseRefreshLease,
    } as unknown as DiscoveryCacheRepository,
  );
  const media: MediaSummary = {
    id: "tv:1",
    tmdbId: 1,
    mediaType: MediaType.Tv,
    title: "Goblin",
    originalTitle: "Goblin",
    backdropUrl: "https://image.tmdb.org/t/p/w780/goblin.jpg",
    originCountry: ["KR"],
    genreIds: [18],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns fresh shared cache entries without calling TMDB", async () => {
    findByKey.mockImplementation((key) =>
      Promise.resolve(cacheEntry(key, [media], 60_000)),
    );

    const response = await service.getHome();

    expect(response.featured).toEqual(media);
    expect(response.shelves).toHaveLength(5);
    expect(response.shelves.every((shelf) => shelf.items.length === 1))
      .toBe(true);
    expect(discover).not.toHaveBeenCalled();
    expect(tryAcquireRefreshLease).not.toHaveBeenCalled();
  });

  it("refreshes expired shelves and stores a 24-hour freshness window", async () => {
    findByKey.mockResolvedValue(null);
    tryAcquireRefreshLease.mockResolvedValue(true);
    discover.mockImplementation((request) =>
      Promise.resolve(tmdbPayload(request.mediaType)),
    );
    store.mockResolvedValue(undefined);

    const before = Date.now();
    const response = await service.getHome();
    const after = Date.now();

    expect(response.shelves).toHaveLength(5);
    expect(discover).toHaveBeenCalledTimes(5);
    expect(store).toHaveBeenCalledTimes(5);

    for (const call of store.mock.calls) {
      const input = call[1];
      expect(input.freshUntil.getTime() - input.refreshedAt.getTime())
        .toBe(24 * 60 * 60 * 1_000);
      expect(input.refreshedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(input.refreshedAt.getTime()).toBeLessThanOrEqual(after);
    }
  });

  it("serves stale data while another instance owns the refresh lease", async () => {
    findByKey.mockImplementation((key) =>
      Promise.resolve(cacheEntry(key, [media], -60_000)),
    );
    tryAcquireRefreshLease.mockResolvedValue(false);

    const response = await service.getHome();

    expect(response.shelves.every((shelf) => shelf.items[0] === media))
      .toBe(true);
    expect(discover).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it("falls back to stale data when TMDB fails during a refresh", async () => {
    findByKey.mockImplementation((key) =>
      Promise.resolve(cacheEntry(key, [media], -60_000)),
    );
    tryAcquireRefreshLease.mockResolvedValue(true);
    discover.mockRejectedValue(new Error("TMDB unavailable"));
    releaseRefreshLease.mockResolvedValue(undefined);

    const response = await service.getHome();

    expect(response.shelves.every((shelf) => shelf.items[0] === media))
      .toBe(true);
    expect(releaseRefreshLease).toHaveBeenCalledTimes(5);
  });

  it("builds Korean discovery filters and a guarded top-rated shelf", () => {
    const definitions = createDiscoveryShelfDefinitions(
      new Date("2026-07-26T12:00:00.000Z"),
    );

    const airing = definitions.find(
      ({ key }) => key === DiscoveryShelfKey.AiringKdramas,
    );
    const topRated = definitions.find(
      ({ key }) => key === DiscoveryShelfKey.TopRatedKdramas,
    );

    expect(airing?.request).toMatchObject({
      originCountry: "KR",
      airDateGte: "2026-07-26",
      airDateLte: "2026-08-02",
    });
    expect(topRated?.request).toMatchObject({
      sortBy: "vote_average.desc",
      voteCountGte: 200,
    });
  });
});

function cacheEntry(
  key: DiscoveryShelfKey,
  items: MediaSummary[],
  freshnessOffset: number,
): StoredDiscoveryCache {
  const now = Date.now();
  return {
    key,
    items,
    refreshedAt: new Date(now - 60_000),
    freshUntil: new Date(now + freshnessOffset),
    deleteAfter: new Date(now + 7 * 24 * 60 * 60 * 1_000),
  };
}

function tmdbPayload(mediaType: MediaType): unknown {
  return {
    page: 1,
    total_pages: 1,
    total_results: 1,
    results: [
      mediaType === MediaType.Tv
        ? {
            id: 1,
            name: "Goblin",
            original_name: "Goblin",
            origin_country: ["KR"],
            genre_ids: [18],
            backdrop_path: "/goblin.jpg",
          }
        : {
            id: 2,
            title: "Parasite",
            original_title: "Parasite",
            genre_ids: [18],
            backdrop_path: "/parasite.jpg",
          },
    ],
  };
}
