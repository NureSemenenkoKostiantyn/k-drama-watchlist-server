import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type CommentDocument,
  CommentSchema,
} from "./schema/comment.schema";

export const COMMENT_MODEL_NAME = "Comment";
export const COMMENT_MODEL = Symbol("COMMENT_MODEL");

export const commentModelProvider: Provider<Model<CommentDocument>> = {
  provide: COMMENT_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<CommentDocument> =>
    connection.model<CommentDocument>(COMMENT_MODEL_NAME, CommentSchema),
};
