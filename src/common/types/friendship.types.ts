import { type PublicUserProfileResponse } from "./user.types";

export type FriendshipStatus = "pending" | "accepted" | "blocked";
export type FriendshipDirection = "incoming" | "outgoing";

export interface FriendshipResponse {
  id: string;
  status: FriendshipStatus;
  direction: FriendshipDirection;
  user: PublicUserProfileResponse;
  createdAt: string;
  acceptedAt?: string;
}

export interface FriendshipsResponse {
  friends: FriendshipResponse[];
  incomingRequests: FriendshipResponse[];
  outgoingRequests: FriendshipResponse[];
}
