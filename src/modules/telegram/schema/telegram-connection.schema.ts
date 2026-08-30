import { Schema, type Types } from "mongoose";

export interface TelegramConnectionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  telegramUserId: string;
  privateChatId: string;
  telegramUsername?: string;
  telegramDisplayName: string;
  linkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const TelegramConnectionSchema =
  new Schema<TelegramConnectionDocument>(
    {
      userId: { type: Schema.Types.ObjectId, required: true },
      telegramUserId: { type: String, required: true },
      privateChatId: { type: String, required: true },
      telegramUsername: { type: String, maxlength: 64 },
      telegramDisplayName: {
        type: String,
        required: true,
        maxlength: 256,
      },
      linkedAt: { type: Date, required: true },
    },
    {
      collection: "telegramConnections",
      timestamps: true,
      versionKey: false,
    },
  );

TelegramConnectionSchema.index({ userId: 1 }, { unique: true });
TelegramConnectionSchema.index(
  { telegramUserId: 1 },
  { unique: true },
);
