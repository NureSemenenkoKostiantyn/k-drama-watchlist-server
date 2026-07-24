import { Schema, type Types } from "mongoose";

export interface PriorityLaneDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  position: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PriorityLaneSchema = new Schema<PriorityLaneDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    isDefault: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    collection: "priorityLanes",
    timestamps: true,
    versionKey: false,
  },
);

PriorityLaneSchema.index({ userId: 1, position: 1 });
