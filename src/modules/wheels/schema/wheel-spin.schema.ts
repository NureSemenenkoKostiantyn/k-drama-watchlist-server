import { Schema, type Types } from "mongoose";

export interface WheelSpinDocument {
  _id: Types.ObjectId;
  wheelId: Types.ObjectId;
  selectedItemId: Types.ObjectId;
  spunByUserId: Types.ObjectId;
  createdAt: Date;
}

export const WheelSpinSchema = new Schema<WheelSpinDocument>(
  {
    wheelId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    selectedItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    spunByUserId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    collection: "wheelSpins",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

WheelSpinSchema.index({ wheelId: 1, createdAt: -1 });
