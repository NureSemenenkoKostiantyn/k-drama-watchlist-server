import { Schema, type Types } from "mongoose";

export interface CommentDocument {
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

export const CommentSchema = new Schema<CommentDocument>(
  {
    listId: { type: Schema.Types.ObjectId, required: true },
    listItemId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true, maxlength: 2_000 },
    hasSpoiler: { type: Boolean, required: true, default: false },
    parentCommentId: Schema.Types.ObjectId,
    createdAt: { type: Date, required: true, default: Date.now },
    editedAt: Date,
    deletedAt: Date,
  },
  { collection: "comments", versionKey: false },
);

CommentSchema.index({ listItemId: 1, createdAt: 1 });
CommentSchema.index({ listId: 1, createdAt: 1 });
CommentSchema.index({ parentCommentId: 1, createdAt: 1 });
