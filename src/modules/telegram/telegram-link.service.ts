import { createHash, randomBytes } from "node:crypto";

import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  type TelegramConnectionResponse,
  type TelegramLinkResponse,
} from "../../common/types/telegram.types";
import { type Environment } from "../../config/environment";
import {
  TelegramIdentityAlreadyLinkedError,
  type TelegramIdentity,
  TelegramRepository,
} from "./telegram.repository";

@Injectable()
export class TelegramLinkService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly telegramRepository: TelegramRepository,
  ) {}

  async getConnection(
    authenticatedUserId: string,
  ): Promise<TelegramConnectionResponse> {
    if (!this.isEnabled()) {
      return { enabled: false, connected: false };
    }

    const connection = await this.telegramRepository.findConnectionByUserId(
      toObjectId(authenticatedUserId),
    );
    const base = {
      enabled: true,
      botUsername: this.botUsername(),
      miniAppUrl:
        this.configService.getOrThrow<string>("TELEGRAM_MINI_APP_URL"),
    };

    if (!connection) {
      return { ...base, connected: false };
    }

    return {
      ...base,
      connected: true,
      telegramDisplayName: connection.telegramDisplayName,
      connectedAt: connection.linkedAt.toISOString(),
      ...(connection.telegramUsername === undefined
        ? {}
        : { telegramUsername: connection.telegramUsername }),
    };
  }

  async createLink(
    authenticatedUserId: string,
  ): Promise<TelegramLinkResponse> {
    this.assertEnabled();
    const token = randomBytes(24).toString("base64url");
    const startParameter = `link_${token}`;
    const ttlMinutes = this.configService.getOrThrow<number>(
      "TELEGRAM_LINK_TTL_MINUTES",
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1_000);

    await this.telegramRepository.saveLinkToken(
      toObjectId(authenticatedUserId),
      hashToken(token),
      expiresAt,
    );

    return {
      deepLink: `https://t.me/${this.botUsername()}?start=${startParameter}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async disconnect(authenticatedUserId: string): Promise<void> {
    await this.telegramRepository.disconnect(
      toObjectId(authenticatedUserId),
    );
  }

  async consumeLink(
    token: string,
    identity: TelegramIdentity,
  ): Promise<TelegramConnectionResponse> {
    this.assertEnabled();
    const userId = await this.telegramRepository.consumeLinkToken(
      hashToken(token),
      new Date(),
    );

    if (!userId) {
      throw invalidOrExpiredLink();
    }

    try {
      const connection = await this.telegramRepository.connect(
        userId,
        identity,
        new Date(),
      );
      return {
        enabled: true,
        connected: true,
        botUsername: this.botUsername(),
        miniAppUrl:
          this.configService.getOrThrow<string>("TELEGRAM_MINI_APP_URL"),
        telegramDisplayName: connection.telegramDisplayName,
        connectedAt: connection.linkedAt.toISOString(),
        ...(connection.telegramUsername === undefined
          ? {}
          : { telegramUsername: connection.telegramUsername }),
      };
    } catch (error: unknown) {
      if (error instanceof TelegramIdentityAlreadyLinkedError) {
        throw telegramAlreadyLinked();
      }

      throw error;
    }
  }

  isEnabled(): boolean {
    return this.configService.getOrThrow<boolean>("TELEGRAM_ENABLED");
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw telegramNotConfigured();
    }
  }

  private botUsername(): string {
    return this.configService.getOrThrow<string>(
      "TELEGRAM_BOT_USERNAME",
    );
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(value);
}

function telegramNotConfigured(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: "TELEGRAM_NOT_CONFIGURED",
    message: "Telegram integration is not configured.",
  });
}

function invalidOrExpiredLink(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "TELEGRAM_LINK_INVALID",
    message: "This Telegram connection link is invalid or expired.",
  });
}

function telegramAlreadyLinked(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "TELEGRAM_ACCOUNT_ALREADY_LINKED",
    message: "This Telegram account is already linked to another user.",
  });
}
