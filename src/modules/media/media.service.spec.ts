import { jest } from "@jest/globals";

import {
  MediaReleaseStatus,
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";
import { type TmdbClient } from "../../integrations/tmdb/tmdb.client";
import { type MediaRepository } from "./media.repository";
import { MediaService } from "./media.service";

describe("MediaService", () => {
  const search = jest.fn<TmdbClient["search"]>();
  const getDetails = jest.fn<TmdbClient["getDetails"]>();
  const upsertSnapshot = jest.fn<MediaRepository["upsertSnapshot"]>();
  const service = new MediaService(
    {
      search,
      getDetails,
    } as unknown as TmdbClient,
    { upsertSnapshot } as unknown as MediaRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters a TV search page to Korean-origin titles", async () => {
    search.mockResolvedValue({
      page: 1,
      total_pages: 1,
      total_results: 2,
      results: [
        {
          id: 1,
          name: "Goblin",
          original_name: "도깨비",
          origin_country: ["KR"],
          genre_ids: [18],
        },
        {
          id: 2,
          name: "Another show",
          original_name: "Another show",
          origin_country: ["US"],
          genre_ids: [18],
        },
      ],
    });

    const response = await service.search({
      q: "Goblin",
      page: 1,
      type: SearchMediaType.Tv,
      country: "KR",
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({
      id: "tv:1",
      originCountry: ["KR"],
    });
  });

  it("rejects country filtering for non-TV searches", async () => {
    await expect(
      service.search({
        q: "Parasite",
        page: 1,
        type: SearchMediaType.Movie,
        country: "KR",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "The country filter is available for TV searches.",
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("returns normalized media details", async () => {
    getDetails.mockResolvedValue({
      id: 496_243,
      title: "Parasite",
      original_title: "기생충",
      release_date: "2019-05-30",
      production_countries: [{ iso_3166_1: "KR" }],
      genres: [{ id: 35 }],
      runtime: 133,
      status: "Released",
    });

    await expect(
      service.getDetails(MediaType.Movie, 496_243),
    ).resolves.toMatchObject({
      id: "movie:496243",
      runtimeMinutes: 133,
      releaseStatus: MediaReleaseStatus.Ended,
    });
  });

  it("refreshes the shared media snapshot from TMDB details", async () => {
    getDetails.mockResolvedValue({
      id: 1,
      name: "A returning drama",
      original_name: "A returning drama",
      origin_country: ["KR"],
      genres: [{ id: 18 }],
      status: "Returning Series",
    });
    upsertSnapshot.mockImplementation((snapshot) =>
      Promise.resolve({
        ...snapshot,
        _id: {} as never,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(service.refresh(MediaType.Tv, 1)).resolves.toMatchObject({
      id: "tv:1",
      releaseStatus: MediaReleaseStatus.Airing,
    });
    expect(upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseStatus: MediaReleaseStatus.Airing,
      }),
    );
  });
});
