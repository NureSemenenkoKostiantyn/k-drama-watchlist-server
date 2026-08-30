import { Schema, type Types } from "mongoose";

export interface TelegramProcessedUpdateDocument {
  _id: Types.ObjectId;
  updateId: number;
  deleteAfter: Date;
  createdAt: Date;
}

export const TelegramProcessedUpdateSchema =
  new Schema<TelegramProcessedUpdateDocument>(
    {
      updateId: { type: Number, required: true },
      deleteAfter: { type: Date, required: true },
    },
    {
      collection: "telegramProcessedUpdates",
      timestamps: { createdAt: true, updatedAt: false },
      versionKey: false,
    },
  );

TelegramProcessedUpdateSchema.index({ updateId: 1 }, { unique: true });
TelegramProcessedUpdateSchema.index(
  { deleteAfter: 1 },
  { expireAfterSeconds: 0 },
);
