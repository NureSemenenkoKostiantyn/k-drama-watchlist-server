import { Schema, type Types } from "mongoose";

import { type FriendshipStatus } from "../../../common/types/friendship.types";

export interface FriendshipDocument {
  _id: Types.ObjectId;
  requesterId: Types.ObjectId;
  recipientId: Types.ObjectId;
  pairKey: string;
  status: FriendshipStatus;
  createdAt: Date;
  acceptedAt?: Date;
}

export const FriendshipSchema = new Schema<FriendshipDocument>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    pairKey: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      required: true,
      default: "pending",
    },
    acceptedAt: Date,
  },
  {
    collection: "friendships",
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  },
);

FriendshipSchema.index({ pairKey: 1 }, { unique: true });
FriendshipSchema.index({ requesterId: 1, status: 1, createdAt: -1 });
FriendshipSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
