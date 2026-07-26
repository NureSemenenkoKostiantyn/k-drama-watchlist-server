import { type WatchStatus } from "./library.types";
import { type PublicUserProfileResponse } from "./user.types";

export interface MediaFriendActivityResponse {
  user: PublicUserProfileResponse;
  status: WatchStatus;
  rating?: number;
}

export interface MediaFriendContextResponse {
  friends: MediaFriendActivityResponse[];
}
