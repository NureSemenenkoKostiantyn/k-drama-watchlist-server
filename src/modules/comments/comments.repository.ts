import { Inject, Injectable } from "@nestjs/common";
import { type HydratedDocument, type Model, Types } from "mongoose";

import { COMMENT_MODEL } from "./comment-model.provider";
import { type CommentDocument } from "./schema/comment.schema";

export interface StoredComment {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  listItemId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  hasSpoiler: boolean;
  parentCommentId?: Types.ObjectId;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

@Injectable()
export class CommentsRepository {
  constructor(
    @Inject(COMMENT_MODEL)
    private readonly model: Model<CommentDocument>,
  ) {}

  async findForItem(
    listId: Types.ObjectId,
    listItemId: Types.ObjectId,
  ): Promise<StoredComment[]> {
    const documents = await this.model
      .find({ listId, listItemId })
      .sort({ createdAt: 1 })
      .exec();
    return documents.map(mapComment);
  }

  async findById(commentId: Types.ObjectId): Promise<StoredComment | null> {
    const document = await this.model.findById(commentId).exec();
    return document ? mapComment(document) : null;
  }

  async create(input: {
    listId: Types.ObjectId;
    listItemId: Types.ObjectId;
    authorId: Types.ObjectId;
    body: string;
    hasSpoiler: boolean;
    parentCommentId?: Types.ObjectId;
    createdAt: Date;
  }): Promise<StoredComment> {
    return mapComment(await this.model.create(input));
  }

  async update(
    commentId: Types.ObjectId,
    authorId: Types.ObjectId,
    input: { body?: string; hasSpoiler?: boolean },
    editedAt: Date,
  ): Promise<StoredComment | null> {
    const document = await this.model
      .findOneAndUpdate(
        { _id: commentId, authorId, deletedAt: { $exists: false } },
        { $set: { ...input, editedAt } },
        { returnDocument: "after", runValidators: true },
      )
      .exec();
    return document ? mapComment(document) : null;
  }

  async softDelete(
    commentId: Types.ObjectId,
    deletedAt: Date,
  ): Promise<StoredComment | null> {
    const document = await this.model
      .findOneAndUpdate(
        { _id: commentId, deletedAt: { $exists: false } },
        { $set: { deletedAt } },
        { returnDocument: "after" },
      )
      .exec();
    return document ? mapComment(document) : null;
  }
}

function mapComment(document: HydratedDocument<CommentDocument>): StoredComment {
  return {
    _id: document._id,
    listId: document.listId,
    listItemId: document.listItemId,
    authorId: document.authorId,
    body: document.body,
    hasSpoiler: document.hasSpoiler,
    createdAt: document.createdAt,
    ...(document.parentCommentId === undefined
      ? {}
      : { parentCommentId: document.parentCommentId }),
    ...(document.editedAt === undefined ? {} : { editedAt: document.editedAt }),
    ...(document.deletedAt === undefined
      ? {}
      : { deletedAt: document.deletedAt }),
  };
}
