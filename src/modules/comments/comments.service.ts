import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import { type CommentResponse } from "../../common/types/comment.types";
import { NotificationType } from "../../common/types/notification.types";
import { SharedListRole } from "../../common/types/shared-list.types";
import { NotificationsService } from "../notifications/notifications.service";
import {
  type StoredSharedList,
  SharedListsRepository,
} from "../shared-lists/shared-lists.repository";
import { sharedListRoleForUser } from "../shared-lists/shared-lists.service";
import { toPublicUserProfile, UsersService } from "../users/users.service";
import { type CreateCommentDto } from "./dto/create-comment.dto";
import { type UpdateCommentDto } from "./dto/update-comment.dto";
import {
  type StoredComment,
  CommentsRepository,
} from "./comments.repository";

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly sharedListsRepository: SharedListsRepository,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(
    authenticatedUserId: string,
    listId: string,
    itemId: string,
  ): Promise<CommentResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const itemIdObject = new Types.ObjectId(itemId);
    await this.requireItemAccess(userId, listIdObject, itemIdObject);
    return this.withAuthors(
      await this.commentsRepository.findForItem(listIdObject, itemIdObject),
    );
  }

  async create(
    authenticatedUserId: string,
    listId: string,
    itemId: string,
    input: CreateCommentDto,
  ): Promise<CommentResponse> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const itemIdObject = new Types.ObjectId(itemId);
    const list = await this.requireItemAccess(userId, listIdObject, itemIdObject);
    if (!canComment(sharedListRoleForUser(list, userId))) {
      throw commentForbidden();
    }

    const parent = input.parentCommentId
      ? await this.commentsRepository.findById(
          new Types.ObjectId(input.parentCommentId),
        )
      : null;
    if (
      input.parentCommentId &&
      (!parent ||
        parent.deletedAt ||
        !parent.listId.equals(listIdObject) ||
        !parent.listItemId.equals(itemIdObject))
    ) {
      throw parentNotFound();
    }
    if (parent?.parentCommentId) {
      throw invalidComment("Replies can only target a top-level comment.");
    }

    const comment = await this.commentsRepository.create({
      listId: listIdObject,
      listItemId: itemIdObject,
      authorId: userId,
      body: input.body,
      hasSpoiler: input.hasSpoiler ?? false,
      ...(parent ? { parentCommentId: parent._id } : {}),
      createdAt: new Date(),
    });
    await this.publishCommentNotifications(list, comment, parent);
    return this.withAuthor(comment);
  }

  async update(
    authenticatedUserId: string,
    commentId: string,
    input: UpdateCommentDto,
  ): Promise<CommentResponse> {
    if (input.body === undefined && input.hasSpoiler === undefined) {
      throw invalidComment("Provide a comment field to update.");
    }
    const userId = toObjectId(authenticatedUserId);
    const commentIdObject = new Types.ObjectId(commentId);
    const existing = await this.requireCommentAccess(userId, commentIdObject);
    if (!existing.authorId.equals(userId)) throw commentForbidden();
    const comment = await this.commentsRepository.update(
      commentIdObject,
      userId,
      input,
      new Date(),
    );
    if (!comment) throw commentNotFound();
    return this.withAuthor(comment);
  }

  async delete(authenticatedUserId: string, commentId: string): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const commentIdObject = new Types.ObjectId(commentId);
    const comment = await this.requireCommentAccess(userId, commentIdObject);
    const list = await this.requireList(userId, comment.listId);
    if (
      !comment.authorId.equals(userId) &&
      sharedListRoleForUser(list, userId) !== SharedListRole.Owner
    ) {
      throw commentForbidden();
    }
    if (!(await this.commentsRepository.softDelete(commentIdObject, new Date()))) {
      throw commentNotFound();
    }
  }

  private async requireItemAccess(
    userId: Types.ObjectId,
    listId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<StoredSharedList> {
    const list = await this.requireList(userId, listId);
    if (!(await this.sharedListsRepository.findItem(listId, itemId))) {
      throw itemNotFound();
    }
    return list;
  }

  private async requireCommentAccess(
    userId: Types.ObjectId,
    commentId: Types.ObjectId,
  ): Promise<StoredComment> {
    const comment = await this.commentsRepository.findById(commentId);
    if (!comment || comment.deletedAt) throw commentNotFound();
    await this.requireItemAccess(userId, comment.listId, comment.listItemId);
    return comment;
  }

  private async requireList(
    userId: Types.ObjectId,
    listId: Types.ObjectId,
  ): Promise<StoredSharedList> {
    const list = await this.sharedListsRepository.findById(userId, listId);
    if (!list) throw listNotFound();
    return list;
  }

  private async withAuthors(comments: StoredComment[]): Promise<CommentResponse[]> {
    const users = await this.usersService.findStoredByIds(
      uniqueObjectIds(comments.map((comment) => comment.authorId)),
    );
    const byId = new Map(users.map((user) => [user._id.toHexString(), user]));
    return comments.flatMap((comment) => {
      const author = byId.get(comment.authorId.toHexString());
      return author ? [toCommentResponse(comment, toPublicUserProfile(author))] : [];
    });
  }

  private async withAuthor(comment: StoredComment): Promise<CommentResponse> {
    const [response] = await this.withAuthors([comment]);
    if (!response) throw commentNotFound();
    return response;
  }

  private async publishCommentNotifications(
    list: StoredSharedList,
    comment: StoredComment,
    parent: StoredComment | null,
  ): Promise<void> {
    const replyRecipient = parent?.authorId.equals(comment.authorId)
      ? undefined
      : parent?.authorId;
    const recipients = uniqueObjectIds(
      list.members
        .map((member) => member.userId)
        .filter(
          (memberId) =>
            !memberId.equals(comment.authorId) &&
            !memberId.equals(replyRecipient ?? comment.authorId),
        ),
    );
    await Promise.all([
      ...(replyRecipient
        ? [
            this.notificationsService.publish({
              userId: replyRecipient,
              type: NotificationType.CommentReply,
              actorUserId: comment.authorId,
              entityId: comment.listId,
            }),
          ]
        : []),
      ...recipients.map((userId) =>
        this.notificationsService.publish({
          userId,
          type: NotificationType.SharedListComment,
          actorUserId: comment.authorId,
          entityId: comment.listId,
        }),
      ),
    ]);
  }
}

export function toCommentResponse(
  comment: StoredComment,
  author: CommentResponse["author"],
): CommentResponse {
  const isDeleted = comment.deletedAt !== undefined;
  return {
    id: comment._id.toHexString(),
    listId: comment.listId.toHexString(),
    listItemId: comment.listItemId.toHexString(),
    author,
    hasSpoiler: isDeleted ? false : comment.hasSpoiler,
    isDeleted,
    createdAt: comment.createdAt.toISOString(),
    ...(isDeleted ? {} : { body: comment.body }),
    ...(comment.parentCommentId ? { parentCommentId: comment.parentCommentId.toHexString() } : {}),
    ...(comment.editedAt ? { editedAt: comment.editedAt.toISOString() } : {}),
    ...(comment.deletedAt ? { deletedAt: comment.deletedAt.toISOString() } : {}),
  };
}

export function canComment(role: SharedListRole | null): boolean {
  return role !== null && role !== SharedListRole.Viewer;
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  return new Types.ObjectId(id);
}

function listNotFound(): ApiException {
  return new ApiException({ statusCode: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Shared list not found." });
}

function itemNotFound(): ApiException {
  return new ApiException({ statusCode: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Shared-list item not found." });
}

function commentNotFound(): ApiException {
  return new ApiException({ statusCode: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Comment not found." });
}

function parentNotFound(): ApiException {
  return new ApiException({ statusCode: HttpStatus.BAD_REQUEST, code: "COMMENT_PARENT_INVALID", message: "The reply target is unavailable." });
}

function commentForbidden(): ApiException {
  return new ApiException({ statusCode: HttpStatus.FORBIDDEN, code: "FORBIDDEN", message: "You do not have permission to change this comment." });
}

function invalidComment(message: string): ApiException {
  return new ApiException({ statusCode: HttpStatus.BAD_REQUEST, code: "VALIDATION_ERROR", message });
}
