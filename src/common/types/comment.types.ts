import { type PublicUserProfileResponse } from "./user.types";

export interface CommentResponse {
  id: string;
  listId: string;
  listItemId: string;
  author: PublicUserProfileResponse;
  body?: string;
  hasSpoiler: boolean;
  parentCommentId?: string;
  isDeleted: boolean;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}
