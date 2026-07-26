import { type PublicUserProfileResponse } from "./user.types";

export enum NotificationType {
  FriendRequest = "friend_request",
  FriendRequestAccepted = "friend_request_accepted",
  SuggestionReceived = "suggestion_received",
  SharedListInvite = "shared_list_invite",
  SharedListComment = "shared_list_comment",
  CommentReply = "comment_reply",
  WheelInvite = "wheel_invite",
  SharedItemUpdated = "shared_item_updated",
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  actor?: PublicUserProfileResponse;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationsResponse {
  items: NotificationResponse[];
  unreadCount: number;
}

export interface MarkAllNotificationsResponse {
  updatedCount: number;
}
