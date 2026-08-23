import { type MediaDetails } from "./media.types";
import { type PublicUserProfileResponse } from "./user.types";

export enum WatchStatus {
  ToWatch = "to_watch",
  Watching = "watching",
  Watched = "watched",
}

export enum AudioType {
  Original = "original",
  Dubbed = "dubbed",
  Mixed = "mixed",
  Unknown = "unknown",
}

export interface LibraryProgress {
  currentSeason: number;
  currentEpisode: number;
  completedEpisodes: number;
  totalEpisodesSnapshot?: number;
  completedSeasonNumbers: number[];
  includeSpecials: boolean;
  updatedAt: string;
}

export interface PlaybackAudioPreference {
  type: AudioType;
  languageCode?: string;
  customLabel?: string;
}

export interface PlaybackPreference {
  audio?: PlaybackAudioPreference;
  subtitleLanguageCode?: string;
}

export interface LibraryEntryResponse {
  id: string;
  mediaId: string;
  status: WatchStatus;
  media: MediaDetails;
  progress?: LibraryProgress;
  rating?: number;
  description?: string;
  categoryIds: string[];
  priorityLaneId?: string;
  priorityPosition?: number;
  playbackPreference?: PlaybackPreference;
  suggestedBy?: PublicUserProfileResponse;
  sharedLists: LibrarySharedListReference[];
  startedAt?: string;
  completedAt?: string;
  lastProgressAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySharedListReference {
  id: string;
  title: string;
}
