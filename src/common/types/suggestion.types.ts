import { type MediaDetails } from "./media.types";
import { type PublicUserProfileResponse } from "./user.types";

export enum SuggestionStatus {
  Pending = "pending",
  Accepted = "accepted",
  Dismissed = "dismissed",
}

export type SuggestionDirection = "received" | "sent";

export interface SuggestionResponse {
  id: string;
  status: SuggestionStatus;
  direction: SuggestionDirection;
  user: PublicUserProfileResponse;
  media: MediaDetails;
  message?: string;
  createdAt: string;
  respondedAt?: string;
}

export interface SuggestionsResponse {
  received: SuggestionResponse[];
  sent: SuggestionResponse[];
}
