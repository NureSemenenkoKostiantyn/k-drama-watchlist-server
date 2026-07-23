import { HttpStatus } from "@nestjs/common";

import { ApiException } from "../../common/errors/api-exception";
import {
  type MediaDetails,
  type MediaSearchResponse,
  type MediaSeason,
  type MediaSummary,
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";

const imageBaseUrl = "https://image.tmdb.org/t/p";

export function normalizeTmdbSearchResponse(
  payload: unknown,
  requestedType: SearchMediaType,
): MediaSearchResponse {
  const response = readRecord(payload);
  const rawResults = response === undefined
    ? undefined
    : readArray(response["results"]);

  if (response === undefined || rawResults === undefined) {
    throw invalidTmdbResponse();
  }

  return {
    page: readPositiveInteger(response["page"]) ?? 1,
    totalPages: readNonNegativeInteger(response["total_pages"]) ?? 0,
    totalResults: readNonNegativeInteger(response["total_results"]) ?? 0,
    results: rawResults.flatMap((result) => {
      const normalized = normalizeSearchItem(result, requestedType);
      return normalized === undefined ? [] : [normalized];
    }),
  };
}

export function normalizeTmdbMediaDetails(
  payload: unknown,
  mediaType: MediaType,
): MediaDetails {
  const media = readRecord(payload);
  const tmdbId = media === undefined
    ? undefined
    : readPositiveInteger(media["id"]);
  const title = media === undefined
    ? undefined
    : readTitle(media, mediaType);

  if (media === undefined || tmdbId === undefined || title === undefined) {
    throw invalidTmdbResponse();
  }

  const posterPath = readOptionalString(media["poster_path"]);
  const backdropPath = readOptionalString(media["backdrop_path"]);
  const originalTitle =
    readOriginalTitle(media, mediaType) ?? title;
  const details: MediaDetails = {
    id: `${mediaType}:${tmdbId}`,
    tmdbId,
    mediaType,
    title,
    originalTitle,
    originCountry: readOriginCountries(media, mediaType),
    genreIds: readGenreIds(media["genres"]),
  };

  assignOptional(details, "overview", readOptionalString(media["overview"]));
  assignOptional(details, "posterPath", posterPath);
  assignOptional(details, "posterUrl", createImageUrl(posterPath, "w500"));
  assignOptional(details, "backdropPath", backdropPath);
  assignOptional(
    details,
    "backdropUrl",
    createImageUrl(backdropPath, "w780"),
  );
  assignOptional(
    details,
    "originalLanguage",
    readOptionalString(media["original_language"]),
  );
  assignOptional(
    details,
    "tmdbVoteAverage",
    readNumber(media["vote_average"]),
  );
  assignOptional(
    details,
    "tmdbVoteCount",
    readNonNegativeInteger(media["vote_count"]),
  );

  if (mediaType === MediaType.Tv) {
    assignOptional(
      details,
      "firstAirDate",
      readOptionalString(media["first_air_date"]),
    );
    assignOptional(
      details,
      "runtimeMinutes",
      readFirstPositiveInteger(media["episode_run_time"]),
    );
    assignOptional(
      details,
      "totalEpisodes",
      readNonNegativeInteger(media["number_of_episodes"]),
    );
    assignOptional(
      details,
      "totalSeasons",
      readNonNegativeInteger(media["number_of_seasons"]),
    );
    assignOptional(details, "seasons", readSeasons(media["seasons"]));
  } else {
    assignOptional(
      details,
      "releaseDate",
      readOptionalString(media["release_date"]),
    );
    assignOptional(
      details,
      "runtimeMinutes",
      readPositiveInteger(media["runtime"]),
    );
  }

  return details;
}

function normalizeSearchItem(
  value: unknown,
  requestedType: SearchMediaType,
): MediaSummary | undefined {
  const item = readRecord(value);

  if (item === undefined) {
    return undefined;
  }

  const mediaType = readSearchMediaType(item, requestedType);
  const tmdbId = readPositiveInteger(item["id"]);
  const title = mediaType === undefined
    ? undefined
    : readTitle(item, mediaType);

  if (
    mediaType === undefined ||
    tmdbId === undefined ||
    title === undefined
  ) {
    return undefined;
  }

  const posterPath = readOptionalString(item["poster_path"]);
  const backdropPath = readOptionalString(item["backdrop_path"]);
  const summary: MediaSummary = {
    id: `${mediaType}:${tmdbId}`,
    tmdbId,
    mediaType,
    title,
    originalTitle: readOriginalTitle(item, mediaType) ?? title,
    originCountry: readStringArray(item["origin_country"]),
    genreIds: readIntegerArray(item["genre_ids"]),
  };

  assignOptional(summary, "overview", readOptionalString(item["overview"]));
  assignOptional(summary, "posterPath", posterPath);
  assignOptional(summary, "posterUrl", createImageUrl(posterPath, "w500"));
  assignOptional(summary, "backdropPath", backdropPath);
  assignOptional(
    summary,
    "backdropUrl",
    createImageUrl(backdropPath, "w780"),
  );
  assignOptional(
    summary,
    "originalLanguage",
    readOptionalString(item["original_language"]),
  );
  assignOptional(
    summary,
    "tmdbVoteAverage",
    readNumber(item["vote_average"]),
  );
  assignOptional(
    summary,
    "tmdbVoteCount",
    readNonNegativeInteger(item["vote_count"]),
  );

  if (mediaType === MediaType.Tv) {
    assignOptional(
      summary,
      "firstAirDate",
      readOptionalString(item["first_air_date"]),
    );
  } else {
    assignOptional(
      summary,
      "releaseDate",
      readOptionalString(item["release_date"]),
    );
  }

  return summary;
}

function readSearchMediaType(
  item: Record<string, unknown>,
  requestedType: SearchMediaType,
): MediaType | undefined {
  if (requestedType === SearchMediaType.Tv) {
    return MediaType.Tv;
  }

  if (requestedType === SearchMediaType.Movie) {
    return MediaType.Movie;
  }

  const mediaType = item["media_type"];
  return mediaType === MediaType.Tv || mediaType === MediaType.Movie
    ? mediaType
    : undefined;
}

function readTitle(
  media: Record<string, unknown>,
  mediaType: MediaType,
): string | undefined {
  return readOptionalString(
    mediaType === MediaType.Tv ? media["name"] : media["title"],
  );
}

function readOriginalTitle(
  media: Record<string, unknown>,
  mediaType: MediaType,
): string | undefined {
  return readOptionalString(
    mediaType === MediaType.Tv
      ? media["original_name"]
      : media["original_title"],
  );
}

function readOriginCountries(
  media: Record<string, unknown>,
  mediaType: MediaType,
): string[] {
  if (mediaType === MediaType.Tv) {
    return readStringArray(media["origin_country"]);
  }

  return (readArray(media["production_countries"]) ?? []).flatMap(
    (country) => {
      const record = readRecord(country);
      const code = record === undefined
        ? undefined
        : readOptionalString(record["iso_3166_1"]);
      return code === undefined ? [] : [code];
    },
  );
}

function readGenreIds(value: unknown): number[] {
  return (readArray(value) ?? []).flatMap((genre) => {
    const record = readRecord(genre);
    const id = record === undefined
      ? undefined
      : readPositiveInteger(record["id"]);
    return id === undefined ? [] : [id];
  });
}

function readSeasons(value: unknown): MediaSeason[] | undefined {
  const seasons = readArray(value);

  if (seasons === undefined) {
    return undefined;
  }

  return seasons.flatMap((season) => {
    const record = readRecord(season);
    const seasonNumber = record === undefined
      ? undefined
      : readNonNegativeInteger(record["season_number"]);
    const name = record === undefined
      ? undefined
      : readOptionalString(record["name"]);
    const episodeCount = record === undefined
      ? undefined
      : readNonNegativeInteger(record["episode_count"]);

    if (
      record === undefined ||
      seasonNumber === undefined ||
      name === undefined ||
      episodeCount === undefined
    ) {
      return [];
    }

    const normalized: MediaSeason = {
      seasonNumber,
      name,
      episodeCount,
    };
    assignOptional(
      normalized,
      "tmdbSeasonId",
      readPositiveInteger(record["id"]),
    );
    assignOptional(
      normalized,
      "airDate",
      readOptionalString(record["air_date"]),
    );
    assignOptional(
      normalized,
      "posterPath",
      readOptionalString(record["poster_path"]),
    );

    return [normalized];
  });
}

function createImageUrl(
  path: string | undefined,
  size: "w500" | "w780",
): string | undefined {
  return path === undefined ? undefined : `${imageBaseUrl}/${size}${path}`;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function readFirstPositiveInteger(value: unknown): number | undefined {
  return (readArray(value) ?? [])
    .map(readPositiveInteger)
    .find((entry) => entry !== undefined);
}

function readStringArray(value: unknown): string[] {
  return (readArray(value) ?? []).flatMap((entry) => {
    const normalized = readOptionalString(entry);
    return normalized === undefined ? [] : [normalized];
  });
}

function readIntegerArray(value: unknown): number[] {
  return (readArray(value) ?? []).flatMap((entry) => {
    const normalized = readPositiveInteger(entry);
    return normalized === undefined ? [] : [normalized];
  });
}

function assignOptional<
  Target extends object,
  Key extends keyof Target,
>(
  target: Target,
  key: Key,
  value: Target[Key] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function invalidTmdbResponse(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_GATEWAY,
    code: "TMDB_REQUEST_FAILED",
    message: "TMDB returned an invalid response.",
  });
}
