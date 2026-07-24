import { type MediaDetails } from "./media.types";

export enum WatchStatus {
  ToWatch = "to_watch",
  Watching = "watching",
  Watched = "watched",
}

export interface LibraryEntryResponse {
  id: string;
  mediaId: string;
  status: WatchStatus;
  media: MediaDetails;
  rating?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
