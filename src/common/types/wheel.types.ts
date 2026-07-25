import { type MediaDetails } from "./media.types";

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

export interface WheelDetailsResponse extends WheelResponse {
  items: WheelItemResponse[];
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
}

export interface WheelSpinHistoryResponse {
  spinId: string;
  selectedItem: SelectedWheelItemResponse;
  createdAt: string;
}
