import { Inject, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import {
  type HydratedDocument,
  type Model,
  Types,
} from "mongoose";

import { type TelegramConnectionDocument } from "./schema/telegram-connection.schema";
import { type TelegramLinkTokenDocument } from "./schema/telegram-link-token.schema";
import { type TelegramProcessedUpdateDocument } from "./schema/telegram-processed-update.schema";
import {
  TELEGRAM_CONNECTION_MODEL,
  TELEGRAM_LINK_TOKEN_MODEL,
  TELEGRAM_PROCESSED_UPDATE_MODEL,
} from "./telegram-model.providers";

export interface StoredTelegramConnection {
  userId: Types.ObjectId;
  telegramUserId: string;
  privateChatId: string;
  telegramUsername?: string;
  telegramDisplayName: string;
  linkedAt: Date;
}

export interface TelegramIdentity {
  telegramUserId: string;
  privateChatId: string;
  telegramUsername?: string;
  telegramDisplayName: string;
}

@Injectable()
export class TelegramRepository {
  constructor(
    @Inject(TELEGRAM_CONNECTION_MODEL)
    private readonly connectionModel: Model<TelegramConnectionDocument>,
    @Inject(TELEGRAM_LINK_TOKEN_MODEL)
    private readonly linkTokenModel: Model<TelegramLinkTokenDocument>,
    @Inject(TELEGRAM_PROCESSED_UPDATE_MODEL)
    private readonly processedUpdateModel: Model<TelegramProcessedUpdateDocument>,
  ) {}

  async findConnectionByUserId(
    userId: Types.ObjectId,
  ): Promise<StoredTelegramConnection | null> {
    const document = await this.connectionModel.findOne({ userId }).exec();
    return document ? mapConnection(document) : null;
  }

  async findConnectionByTelegramUserId(
    telegramUserId: string,
  ): Promise<StoredTelegramConnection | null> {
    const document = await this.connectionModel
      .findOne({ telegramUserId })
      .exec();
    return document ? mapConnection(document) : null;
  }

  async saveLinkToken(
    userId: Types.ObjectId,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.linkTokenModel
      .findOneAndUpdate(
        { userId },
        { $set: { tokenHash, expiresAt }, $setOnInsert: { userId } },
        { upsert: true, runValidators: true },
      )
      .exec();
  }

  async consumeLinkToken(
    tokenHash: string,
    now: Date,
  ): Promise<Types.ObjectId | null> {
    const document = await this.linkTokenModel
      .findOneAndDelete({ tokenHash, expiresAt: { $gt: now } })
      .exec();
    return document?.userId ?? null;
  }

  async connect(
    userId: Types.ObjectId,
    identity: TelegramIdentity,
    linkedAt: Date,
  ): Promise<StoredTelegramConnection> {
    const usedBy = await this.findConnectionByTelegramUserId(
      identity.telegramUserId,
    );

    if (usedBy && !usedBy.userId.equals(userId)) {
      throw new TelegramIdentityAlreadyLinkedError();
    }

    try {
      const document = await this.connectionModel
        .findOneAndUpdate(
          { userId },
          {
            $set: {
              ...identity,
              linkedAt,
            },
            $setOnInsert: { userId },
          },
          {
            returnDocument: "after",
            runValidators: true,
            upsert: true,
          },
        )
        .exec();

      if (!document) {
        throw new Error("Telegram connection update returned no document");
      }

      return mapConnection(document);
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11_000) {
        throw new TelegramIdentityAlreadyLinkedError();
      }

      throw error;
    }
  }

  async disconnect(userId: Types.ObjectId): Promise<boolean> {
    const result = await this.connectionModel.deleteOne({ userId }).exec();
    await this.linkTokenModel.deleteOne({ userId }).exec();
    return result.deletedCount === 1;
  }

  async claimUpdate(updateId: number, now: Date): Promise<boolean> {
    try {
      await this.processedUpdateModel.create({
        updateId,
        deleteAfter: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000),
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11_000) {
        return false;
      }

      throw error;
    }
  }

  async releaseUpdate(updateId: number): Promise<void> {
    await this.processedUpdateModel.deleteOne({ updateId }).exec();
  }
}

export class TelegramIdentityAlreadyLinkedError extends Error {}

function mapConnection(
  document: HydratedDocument<TelegramConnectionDocument>,
): StoredTelegramConnection {
  return {
    userId: document.userId,
    telegramUserId: document.telegramUserId,
    privateChatId: document.privateChatId,
    telegramDisplayName: document.telegramDisplayName,
    linkedAt: document.linkedAt,
    ...(document.telegramUsername === undefined
      ? {}
      : { telegramUsername: document.telegramUsername }),
  };
}
