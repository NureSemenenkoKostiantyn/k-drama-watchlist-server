import { type WatchStatus } from "./library.types";
import { type MediaSummary } from "./media.types";
import { type PublicUserProfileResponse } from "./user.types";

export enum ActivityType {
  LibraryAdded = "library_added",
  LibraryRated = "library_rated",
  LibraryStatusChanged = "library_status_changed",
}

export interface ActivityFeedItemResponse {
  id: string;
  type: ActivityType;
  actor: PublicUserProfileResponse;
  media: MediaSummary;
  status?: WatchStatus;
  rating?: number;
  createdAt: string;
}

export interface ActivityFeedResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  items: ActivityFeedItemResponse[];
}
