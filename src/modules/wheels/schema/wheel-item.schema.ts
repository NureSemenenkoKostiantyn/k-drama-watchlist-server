import { Schema, type Types } from "mongoose";

export interface WheelItemDocument {
  _id: Types.ObjectId;
  wheelId: Types.ObjectId;
  mediaId: Types.ObjectId;
  addedByUserId: Types.ObjectId;
  position: number;
  weight: number;
  isEnabled: boolean;
  lastSelectedAt?: Date;
  selectionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const WheelItemSchema = new Schema<WheelItemDocument>(
  {
    wheelId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    addedByUserId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    weight: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 1,
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    lastSelectedAt: Date,
    selectionCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    collection: "wheelItems",
    timestamps: true,
    versionKey: false,
  },
);

WheelItemSchema.index({ wheelId: 1, mediaId: 1 }, { unique: true });
WheelItemSchema.index({ wheelId: 1, position: 1 });
