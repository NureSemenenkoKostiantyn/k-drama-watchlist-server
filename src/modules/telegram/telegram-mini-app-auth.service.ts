import { createHmac, timingSafeEqual } from "node:crypto";

import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ApiException } from "../../common/errors/api-exception";
import { type TelegramMiniAppSessionResponse } from "../../common/types/telegram.types";
import { type Environment } from "../../config/environment";
import { UsersService } from "../users/users.service";
import { TelegramLinkService } from "./telegram-link.service";
import { TelegramRepository } from "./telegram.repository";

const MAX_INIT_DATA_LENGTH = 8_192;

interface ValidatedTelegramMiniAppUser {
  id: string;
}

@Injectable()
export class TelegramMiniAppAuthService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly linkService: TelegramLinkService,
    private readonly telegramRepository: TelegramRepository,
    private readonly usersService: UsersService,
  ) {}

  async authenticate(
    initData: string | undefined,
  ): Promise<TelegramMiniAppSessionResponse> {
    const connection = await this.resolveConnection(initData);

    return {
      account: await this.usersService.getById(connection.userId.toHexString()),
      telegramDisplayName: connection.telegramDisplayName,
      ...(connection.telegramUsername === undefined
        ? {}
        : { telegramUsername: connection.telegramUsername }),
    };
  }

  async resolveUserId(initData: string | undefined): Promise<string> {
    return (await this.resolveConnection(initData)).userId.toHexString();
  }

  private async resolveConnection(initData: string | undefined) {
    if (!this.linkService.isEnabled()) {
      throw telegramMiniAppNotFound();
    }

    const telegramUser = validateTelegramInitData(
      initData,
      this.configService.getOrThrow<string>("TELEGRAM_BOT_TOKEN"),
      this.configService.getOrThrow<number>(
        "TELEGRAM_INIT_DATA_MAX_AGE_SECONDS",
      ),
      new Date(),
    );
    const connection =
      await this.telegramRepository.findConnectionByTelegramUserId(
        telegramUser.id,
      );

    if (!connection) {
      throw telegramAccountNotLinked();
    }

    return connection;
  }
}

export function validateTelegramInitData(
  initData: string | undefined,
  botToken: string,
  maxAgeSeconds: number,
  now: Date,
): ValidatedTelegramMiniAppUser {
  if (!initData || initData.length > MAX_INIT_DATA_LENGTH) {
    throw invalidTelegramInitData();
  }

  const parameters = new URLSearchParams(initData);
  const hash = readSingleParameter(parameters, "hash");
  const authDateValue = readSingleParameter(parameters, "auth_date");
  const userValue = readSingleParameter(parameters, "user");

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !authDateValue || !userValue) {
    throw invalidTelegramInitData();
  }

  const dataCheckString = [...parameters.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => compareTelegramKeys(left, right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const suppliedHash = Buffer.from(hash, "hex");

  if (
    suppliedHash.length !== expectedHash.length ||
    !timingSafeEqual(suppliedHash, expectedHash)
  ) {
    throw invalidTelegramInitData();
  }

  const authDate = Number(authDateValue);
  const nowSeconds = Math.floor(now.getTime() / 1_000);

  if (
    !Number.isSafeInteger(authDate) ||
    authDate > nowSeconds + 30 ||
    nowSeconds - authDate > maxAgeSeconds
  ) {
    throw expiredTelegramInitData();
  }

  let user: unknown;
  try {
    user = JSON.parse(userValue);
  } catch {
    throw invalidTelegramInitData();
  }

  if (!isRecord(user) || !isTelegramUserId(user["id"])) {
    throw invalidTelegramInitData();
  }

  return { id: String(user["id"]) };
}

function readSingleParameter(
  parameters: URLSearchParams,
  name: string,
): string | null {
  const values = parameters.getAll(name);
  return values.length === 1 ? (values[0] ?? null) : null;
}

function compareTelegramKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTelegramUserId(value: unknown): value is string | number {
  return (
    (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
    (typeof value === "string" && /^[1-9]\d*$/.test(value))
  );
}

function invalidTelegramInitData(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.UNAUTHORIZED,
    code: "TELEGRAM_INIT_DATA_INVALID",
    message: "Telegram Mini App authentication failed.",
  });
}

function expiredTelegramInitData(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.UNAUTHORIZED,
    code: "TELEGRAM_INIT_DATA_EXPIRED",
    message: "Reopen the Mini App from Telegram to continue.",
  });
}

function telegramAccountNotLinked(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.FORBIDDEN,
    code: "TELEGRAM_ACCOUNT_NOT_LINKED",
    message: "Connect this Telegram account from Drama Watch settings first.",
  });
}

function telegramMiniAppNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Resource not found.",
  });
}
