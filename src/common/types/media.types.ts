export enum MediaType {
  Movie = "movie",
  Tv = "tv",
}

export enum SearchMediaType {
  All = "all",
  Movie = MediaType.Movie,
  Tv = MediaType.Tv,
}

export interface MediaImageData {
  backdropPath?: string;
  backdropUrl?: string;
  posterPath?: string;
  posterUrl?: string;
}

export interface MediaSummary extends MediaImageData {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  originCountry: string[];
  originalLanguage?: string;
  genreIds: number[];
  tmdbVoteAverage?: number;
  tmdbVoteCount?: number;
}

export interface MediaSeason {
  tmdbSeasonId?: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
}

export interface MediaDetails extends MediaSummary {
  runtimeMinutes?: number;
  totalEpisodes?: number;
  totalSeasons?: number;
  seasons?: MediaSeason[];
}

export interface MediaSearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MediaSummary[];
}
