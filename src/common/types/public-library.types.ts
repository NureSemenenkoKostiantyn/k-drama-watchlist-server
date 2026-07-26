import { type WatchStatus } from "./library.types";
import { type MediaSummary } from "./media.types";
import { type LibraryVisibility } from "./settings.types";
import { type PublicUserProfileResponse } from "./user.types";

export enum PublicLibrarySort {
  RecentlyUpdated = "recent",
  TitleAscending = "title_asc",
  TitleDescending = "title_desc",
  RatingDescending = "rating_desc",
  ReleaseDateDescending = "release_desc",
  ReleaseDateAscending = "release_asc",
}

export interface PublicLibraryItemResponse {
  media: MediaSummary;
  status: WatchStatus;
  rating?: number;
}

export interface PublicLibraryResponse {
  user: PublicUserProfileResponse;
  visibility: LibraryVisibility;
  isOwner: boolean;
  page: number;
  totalPages: number;
  totalResults: number;
  items: PublicLibraryItemResponse[];
}
