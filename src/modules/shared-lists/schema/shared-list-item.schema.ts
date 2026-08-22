import { Schema, type Types } from "mongoose";

import { SharedListItemStatus } from "../../../common/types/shared-list.types";

export interface SharedListProgressDocument {
  currentSeason: number;
  currentEpisode: number;
}

export interface SharedListItemDocument {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  mediaId: Types.ObjectId;
  addedByUserId: Types.ObjectId;
  position: number;
  note?: string;
  groupStatus?: SharedListItemStatus;
  groupProgress?: SharedListProgressDocument;
  createdAt: Date;
  updatedAt: Date;
}

const SharedListProgressSchema = new Schema<SharedListProgressDocument>(
  {
    currentSeason: { type: Number, required: true, min: 0 },
    currentEpisode: { type: Number, required: true, min: 0 },
  },
  { _id: false, versionKey: false },
);

export const SharedListItemSchema = new Schema<SharedListItemDocument>(
  {
    listId: { type: Schema.Types.ObjectId, required: true },
    mediaId: { type: Schema.Types.ObjectId, required: true },
    addedByUserId: { type: Schema.Types.ObjectId, required: true },
    position: { type: Number, required: true, min: 0 },
    note: { type: String, maxlength: 2_000 },
    groupStatus: {
      type: String,
      enum: Object.values(SharedListItemStatus),
    },
    groupProgress: SharedListProgressSchema,
  },
  {
    collection: "sharedListItems",
    timestamps: true,
    versionKey: false,
  },
);

SharedListItemSchema.index({ listId: 1, mediaId: 1 }, { unique: true });
SharedListItemSchema.index({ listId: 1, position: 1 });
