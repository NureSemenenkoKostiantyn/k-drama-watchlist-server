import { type MediaDetails, type MediaType } from "./media.types";
import { type PublicUserProfileResponse } from "./user.types";

export enum SharedListVisibility {
  Private = "private",
  Unlisted = "unlisted",
  Public = "public",
}

export enum SharedListRole {
  Owner = "owner",
  Editor = "editor",
  Commenter = "commenter",
  Viewer = "viewer",
}

export enum SharedListItemStatus {
  Planned = "planned",
  Watching = "watching",
  Finished = "finished",
}

export interface SharedListResponse {
  id: string;
  title: string;
  description?: string;
  visibility: SharedListVisibility;
  publicSlug?: string;
  role: SharedListRole;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SharedListMemberResponse {
  user: PublicUserProfileResponse;
  role: SharedListRole;
  joinedAt: string;
}

export interface SharedListProgressResponse {
  currentSeason: number;
  currentEpisode: number;
}

export interface SharedListItemResponse {
  id: string;
  mediaId: string;
  position: number;
  media: MediaDetails;
  addedBy?: PublicUserProfileResponse;
  note?: string;
  groupStatus?: SharedListItemStatus;
  groupProgress?: SharedListProgressResponse;
  createdAt: string;
  updatedAt: string;
}

export interface SharedListDetailsResponse extends SharedListResponse {
  members: SharedListMemberResponse[];
  items: SharedListItemResponse[];
}

export interface PublicSharedListItemResponse {
  position: number;
  media: Omit<MediaDetails, "id">;
  addedBy?: PublicUserProfileResponse;
  note?: string;
  groupStatus?: SharedListItemStatus;
  groupProgress?: SharedListProgressResponse;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSharedListDetailsResponse {
  title: string;
  description?: string;
  visibility: SharedListVisibility.Unlisted | SharedListVisibility.Public;
  publicSlug: string;
  itemCount: number;
  members: SharedListMemberResponse[];
  items: PublicSharedListItemResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicSharedListPreviewMediaResponse {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string;
  posterUrl?: string;
}

export interface PublicSharedListDiscoveryItemResponse {
  title: string;
  description?: string;
  publicSlug: string;
  itemCount: number;
  owner?: PublicUserProfileResponse;
  previewMedia: PublicSharedListPreviewMediaResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicSharedListDiscoveryResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  items: PublicSharedListDiscoveryItemResponse[];
}

export interface SharedListInviteResponse {
  id: string;
  acceptUrl: string;
  target: PublicUserProfileResponse;
  role: Exclude<SharedListRole, SharedListRole.Owner>;
  expiresAt: string;
  createdAt: string;
}

export interface SharedListPendingInviteResponse {
  id: string;
  target: PublicUserProfileResponse;
  role: Exclude<SharedListRole, SharedListRole.Owner>;
  expiresAt: string;
  createdAt: string;
}
