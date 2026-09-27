import { Schema, type Types } from "mongoose";
import {
  TierColor,
  TierListVisibility,
} from "../../../common/types/tier-list.types";

export interface StoredTierRow {
  id: string;
  label: string;
  color: TierColor;
  mediaIds: Types.ObjectId[];
}

export interface TierListDocument {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description: string;
  visibility: TierListVisibility;
  publicSlug?: string;
  revision: number;
  tiers: StoredTierRow[];
  unrankedMediaIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TierRowSchema = new Schema<StoredTierRow>(
  {
    id: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, maxlength: 40 },
    color: { type: String, enum: Object.values(TierColor), required: true },
    mediaIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { _id: false },
);

export const TierListSchema = new Schema<TierListDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 1000 },
    visibility: {
      type: String,
      enum: Object.values(TierListVisibility),
      default: TierListVisibility.Private,
    },
    publicSlug: { type: String, maxlength: 16 },
    revision: { type: Number, default: 0, min: 0, required: true },
    tiers: { type: [TierRowSchema], required: true },
    unrankedMediaIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { collection: "tierLists", timestamps: true, versionKey: false },
);

TierListSchema.index({ ownerId: 1, updatedAt: -1 });
TierListSchema.index({ publicSlug: 1 }, { sparse: true, unique: true });
TierListSchema.index({ visibility: 1, updatedAt: -1 });
