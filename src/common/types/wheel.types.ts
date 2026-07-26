import { type MediaDetails } from "./media.types";
import { type PublicUserProfileResponse } from "./user.types";

export enum WheelVisibility {
  Private = "private",
  Unlisted = "unlisted",
  Public = "public",
}

export enum WheelSelectionMode {
  FullyRandom = "fully_random",
  AvoidRecentWinners = "avoid_recent_winners",
}

export enum WheelRole {
  Owner = "owner",
  Editor = "editor",
  Viewer = "viewer",
}

export interface WheelResponse {
  id: string;
  title: string;
  description?: string;
  visibility: WheelVisibility;
  role: WheelRole;
  selectionMode: WheelSelectionMode;
  itemCount: number;
  enabledItemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WheelItemResponse {
  id: string;
  mediaId: string;
  position: number;
  weight: number;
  isEnabled: boolean;
  lastSelectedAt?: string;
  selectionCount: number;
  media: MediaDetails;
  createdAt: string;
  updatedAt: string;
}

export interface WheelMemberResponse {
  user: PublicUserProfileResponse;
  role: WheelRole;
}

export interface WheelDetailsResponse extends WheelResponse {
  items: WheelItemResponse[];
  members: WheelMemberResponse[];
}

export interface SelectedWheelItemResponse {
  wheelItemId: string;
  mediaId: string;
  title: string;
  posterUrl?: string;
}

export interface WheelSpinResponse {
  spinId: string;
  selectedItem: SelectedWheelItemResponse;
  spunBy?: PublicUserProfileResponse;
  createdAt: string;
}

export type WheelSpinHistoryResponse = WheelSpinResponse;
