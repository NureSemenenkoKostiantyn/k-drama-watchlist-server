import { type MediaDetails } from "./media.types";
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

export interface SharedListInviteResponse {
  acceptUrl: string;
  role: Exclude<SharedListRole, SharedListRole.Owner>;
  expiresAt: string;
}
