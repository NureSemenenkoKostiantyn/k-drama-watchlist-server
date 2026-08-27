import { Schema, type Types } from "mongoose";

import {
  WheelRole,
  WheelSelectionMode,
  WheelVisibility,
} from "../../../common/types/wheel.types";

export interface WheelMemberDocument {
  userId: Types.ObjectId;
  role: WheelRole;
}

export interface WheelDocument {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  visibility: WheelVisibility;
  publicSlug?: string;
  selectionMode: WheelSelectionMode;
  members: WheelMemberDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const WheelMemberSchema = new Schema<WheelMemberDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(WheelRole),
      required: true,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

export const WheelSchema = new Schema<WheelDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 1_000,
    },
    visibility: {
      type: String,
      enum: Object.values(WheelVisibility),
      required: true,
      default: WheelVisibility.Private,
    },
    publicSlug: {
      type: String,
      maxlength: 120,
    },
    selectionMode: {
      type: String,
      enum: Object.values(WheelSelectionMode),
      required: true,
      default: WheelSelectionMode.FullyRandom,
    },
    members: {
      type: [WheelMemberSchema],
      required: true,
      default: [],
    },
  },
  {
    collection: "wheels",
    timestamps: true,
    versionKey: false,
  },
);

WheelSchema.index({ ownerId: 1, updatedAt: -1 });
WheelSchema.index({ "members.userId": 1, updatedAt: -1 });
WheelSchema.index({ publicSlug: 1 }, { sparse: true, unique: true });
WheelSchema.index({ visibility: 1, updatedAt: -1 });
