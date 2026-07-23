import { MediaType, SearchMediaType } from "../../common/types/media.types";
import {
  normalizeTmdbMediaDetails,
  normalizeTmdbSearchResponse,
} from "./tmdb.normalizer";

describe("TMDB normalization", () => {
  it("normalizes mixed TV and movie search results and removes people", () => {
    const response = normalizeTmdbSearchResponse(
      {
        page: 1,
        total_pages: 3,
        total_results: 45,
        results: [
          {
            id: 1,
            media_type: "tv",
            name: "Goblin",
            original_name: "쓸쓸하고 찬란하神 - 도깨비",
            first_air_date: "2016-12-02",
            origin_country: ["KR"],
            genre_ids: [18],
            poster_path: "/goblin.jpg",
            vote_average: 8.6,
            vote_count: 3100,
          },
          {
            id: 2,
            media_type: "movie",
            title: "Parasite",
            original_title: "기생충",
            release_date: "2019-05-30",
            genre_ids: [35, 53],
            poster_path: "/parasite.jpg",
          },
          {
            id: 3,
            media_type: "person",
            name: "An actor",
          },
        ],
      },
      SearchMediaType.All,
    );

    expect(response).toMatchObject({
      page: 1,
      totalPages: 3,
      totalResults: 45,
    });
    expect(response.results).toEqual([
      expect.objectContaining({
        id: "tv:1",
        mediaType: MediaType.Tv,
        title: "Goblin",
        originalTitle: "쓸쓸하고 찬란하神 - 도깨비",
        firstAirDate: "2016-12-02",
        originCountry: ["KR"],
        posterPath: "/goblin.jpg",
        posterUrl: "https://image.tmdb.org/t/p/w500/goblin.jpg",
      }),
      expect.objectContaining({
        id: "movie:2",
        mediaType: MediaType.Movie,
        title: "Parasite",
        originalTitle: "기생충",
        releaseDate: "2019-05-30",
      }),
    ]);
  });

  it("normalizes TV details including progress-ready season summaries", () => {
    const details = normalizeTmdbMediaDetails(
      {
        id: 1396,
        name: "Breaking Bad",
        original_name: "Breaking Bad",
        overview: "A chemistry teacher changes course.",
        first_air_date: "2008-01-20",
        origin_country: ["US"],
        original_language: "en",
        genres: [{ id: 18, name: "Drama" }],
        episode_run_time: [45],
        number_of_episodes: 62,
        number_of_seasons: 5,
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        seasons: [
          {
            id: 3624,
            season_number: 0,
            name: "Specials",
            episode_count: 9,
            air_date: "2009-02-17",
            poster_path: "/specials.jpg",
          },
          {
            id: 3572,
            season_number: 1,
            name: "Season 1",
            episode_count: 7,
            air_date: "2008-01-20",
          },
        ],
        vote_average: 8.9,
        vote_count: 15_000,
      },
      MediaType.Tv,
    );

    expect(details).toMatchObject({
      id: "tv:1396",
      totalEpisodes: 62,
      totalSeasons: 5,
      runtimeMinutes: 45,
      backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
      seasons: [
        {
          tmdbSeasonId: 3624,
          seasonNumber: 0,
          name: "Specials",
          episodeCount: 9,
        },
        {
          tmdbSeasonId: 3572,
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 7,
        },
      ],
    });
  });

  it("normalizes movie runtime and production countries", () => {
    const details = normalizeTmdbMediaDetails(
      {
        id: 496_243,
        title: "Parasite",
        original_title: "기생충",
        release_date: "2019-05-30",
        production_countries: [{ iso_3166_1: "KR" }],
        genres: [{ id: 35 }],
        runtime: 133,
      },
      MediaType.Movie,
    );

    expect(details).toMatchObject({
      id: "movie:496243",
      originCountry: ["KR"],
      runtimeMinutes: 133,
    });
  });

  it("rejects structurally invalid TMDB payloads", () => {
    expect(() =>
      normalizeTmdbSearchResponse({ results: "invalid" }, SearchMediaType.All),
    ).toThrow("TMDB returned an invalid response.");
    expect(() =>
      normalizeTmdbMediaDetails({ id: "invalid" }, MediaType.Tv),
    ).toThrow("TMDB returned an invalid response.");
  });
});
