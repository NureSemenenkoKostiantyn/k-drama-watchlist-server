import { type MediaSummary } from "./media.types";

export enum DiscoveryShelfKey {
  AiringKdramas = "airing_kdramas",
  NewKdramas = "new_kdramas",
  PopularKdramas = "popular_kdramas",
  PopularMovies = "popular_movies",
  TopRatedKdramas = "top_rated_kdramas",
}

export interface DiscoveryShelfResponse {
  key: DiscoveryShelfKey;
  title: string;
  description: string;
  items: MediaSummary[];
}

export interface DiscoveryHomeResponse {
  featured?: MediaSummary;
  shelves: DiscoveryShelfResponse[];
}
