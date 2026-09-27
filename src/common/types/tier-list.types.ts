import type { MediaType } from "./media.types";
import type { PublicUserProfileResponse } from "./user.types";

export enum TierListVisibility {
  Private = "private",
  Unlisted = "unlisted",
  Public = "public",
}

export enum TierColor {
  Red = "red",
  Orange = "orange",
  Yellow = "yellow",
  Green = "green",
  Blue = "blue",
  Purple = "purple",
  Pink = "pink",
  Gray = "gray",
}

export interface TierListMedia {
  id: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  originalTitle: string;
  posterUrl?: string;
}

export interface TierRowResponse {
  id: string;
  label: string;
  color: TierColor;
  items: TierListMedia[];
}

export interface TierListSummaryResponse {
  id: string;
  title: string;
  description: string;
  visibility: TierListVisibility;
  publicSlug?: string;
  revision: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TierListResponse extends TierListSummaryResponse {
  tiers: TierRowResponse[];
  unranked: TierListMedia[];
}

export interface PublicTierListResponse {
  title: string;
  description: string;
  visibility: TierListVisibility.Public | TierListVisibility.Unlisted;
  publicSlug: string;
  owner?: PublicUserProfileResponse;
  tiers: Array<Omit<TierRowResponse, "id">>;
  itemCount: number;
  updatedAt: string;
}
