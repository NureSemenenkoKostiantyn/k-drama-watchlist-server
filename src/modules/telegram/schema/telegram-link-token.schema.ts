import { Schema, type Types } from "mongoose";

export interface TelegramLinkTokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export const TelegramLinkTokenSchema =
  new Schema<TelegramLinkTokenDocument>(
    {
      userId: { type: Schema.Types.ObjectId, required: true },
      tokenHash: { type: String, required: true },
      expiresAt: { type: Date, required: true },
    },
    {
      collection: "telegramLinkTokens",
      timestamps: { createdAt: true, updatedAt: false },
      versionKey: false,
    },
  );

TelegramLinkTokenSchema.index({ userId: 1 }, { unique: true });
TelegramLinkTokenSchema.index({ tokenHash: 1 }, { unique: true });
TelegramLinkTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);
