import { Schema, type Types } from "mongoose";

import { SharedListRole } from "../../../common/types/shared-list.types";

export interface SharedListInviteDocument {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  tokenHash: string;
  role: Exclude<SharedListRole, SharedListRole.Owner>;
  expiresAt: Date;
  createdAt: Date;
}

export const SharedListInviteSchema =
  new Schema<SharedListInviteDocument>(
    {
      listId: { type: Schema.Types.ObjectId, required: true },
      createdByUserId: { type: Schema.Types.ObjectId, required: true },
      tokenHash: { type: String, required: true },
      role: {
        type: String,
        enum: [
          SharedListRole.Editor,
          SharedListRole.Commenter,
          SharedListRole.Viewer,
        ],
        required: true,
      },
      expiresAt: { type: Date, required: true },
      createdAt: { type: Date, required: true, default: Date.now },
    },
    {
      collection: "sharedListInvites",
      versionKey: false,
    },
  );

SharedListInviteSchema.index({ tokenHash: 1 }, { unique: true });
SharedListInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SharedListInviteSchema.index({ listId: 1, createdAt: -1 });
