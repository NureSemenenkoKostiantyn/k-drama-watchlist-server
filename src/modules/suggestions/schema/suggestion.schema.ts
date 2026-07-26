import { Schema, type Types } from "mongoose";

import { SuggestionStatus } from "../../../common/types/suggestion.types";
import { MEDIA_MODEL_NAME } from "../../media/media-model.provider";

export interface SuggestionDocument {
  _id: Types.ObjectId;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  mediaId: Types.ObjectId;
  message?: string;
  status: SuggestionStatus;
  createdAt: Date;
  respondedAt?: Date;
}

export const SuggestionSchema = new Schema<SuggestionDocument>(
  {
    fromUserId: { type: Schema.Types.ObjectId, required: true },
    toUserId: { type: Schema.Types.ObjectId, required: true },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: MEDIA_MODEL_NAME,
      required: true,
    },
    message: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: Object.values(SuggestionStatus),
      default: SuggestionStatus.Pending,
      required: true,
    },
    respondedAt: Date,
  },
  {
    collection: "suggestions",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

SuggestionSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
SuggestionSchema.index({ fromUserId: 1, createdAt: -1 });
SuggestionSchema.index(
  { fromUserId: 1, toUserId: 1, mediaId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: SuggestionStatus.Pending,
    },
  },
);
