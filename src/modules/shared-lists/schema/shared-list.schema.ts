import { Schema, type Types } from "mongoose";

import {
  SharedListRole,
  SharedListVisibility,
} from "../../../common/types/shared-list.types";

export interface SharedListMemberDocument {
  userId: Types.ObjectId;
  role: SharedListRole;
  joinedAt: Date;
}

export interface SharedListDocument {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  visibility: SharedListVisibility;
  publicSlug?: string;
  members: SharedListMemberDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const SharedListMemberSchema = new Schema<SharedListMemberDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    role: {
      type: String,
      enum: Object.values(SharedListRole),
      required: true,
    },
    joinedAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false },
);

export const SharedListSchema = new Schema<SharedListDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 2_000 },
    visibility: {
      type: String,
      enum: Object.values(SharedListVisibility),
      required: true,
      default: SharedListVisibility.Private,
    },
    publicSlug: { type: String, maxlength: 120 },
    members: {
      type: [SharedListMemberSchema],
      required: true,
      default: [],
    },
  },
  {
    collection: "sharedLists",
    timestamps: true,
    versionKey: false,
  },
);

SharedListSchema.index({ ownerId: 1, updatedAt: -1 });
SharedListSchema.index({ "members.userId": 1, updatedAt: -1 });
SharedListSchema.index({ publicSlug: 1 }, { sparse: true, unique: true });
SharedListSchema.index({ visibility: 1, updatedAt: -1 });
