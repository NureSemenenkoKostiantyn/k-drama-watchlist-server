import { createHash, timingSafeEqual } from "node:crypto";

import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ApiException } from "../../common/errors/api-exception";
import { type Environment } from "../../config/environment";
import { TelegramApiService } from "./telegram-api.service";
import { TelegramLinkService } from "./telegram-link.service";
import { TelegramRepository } from "./telegram.repository";

interface TelegramMessage {
  chatId: string;
  chatType: string;
  text?: string;
  userId: string;
  username?: string;
  displayName: string;
}

interface TelegramUpdate {
  updateId: number;
  message?: TelegramMessage;
}

@Injectable()
export class TelegramUpdateService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly linkService: TelegramLinkService,
    private readonly telegramRepository: TelegramRepository,
    private readonly telegramApi: TelegramApiService,
  ) {}

  async handle(secret: string | undefined, input: unknown): Promise<void> {
    if (!this.linkService.isEnabled()) {
      throw telegramWebhookNotFound();
    }

    this.verifySecret(secret);
    const update = parseUpdate(input);
    const claimed = await this.telegramRepository.claimUpdate(
      update.updateId,
      new Date(),
    );

    if (!claimed) {
      return;
    }

    try {
      await this.process(update);
    } catch (error: unknown) {
      await this.telegramRepository.releaseUpdate(update.updateId);
      throw error;
    }
  }

  private async process(update: TelegramUpdate): Promise<void> {
    const message = update.message;

    if (!message || message.chatType !== "private") {
      return;
    }

    const startParameter = readStartParameter(message.text);

    if (startParameter?.startsWith("link_")) {
      const token = startParameter.slice("link_".length);

      try {
        await this.linkService.consumeLink(token, {
          telegramUserId: message.userId,
          privateChatId: message.chatId,
          telegramDisplayName: message.displayName,
          ...(message.username === undefined
            ? {}
            : { telegramUsername: message.username }),
        });
        await this.telegramApi.sendMessage(
          message.chatId,
          "Telegram is connected to your Drama Watch account.",
          [
            [
              {
                text: "Open Drama Watch",
                web_app: {
                  url: this.configService.getOrThrow<string>(
                    "TELEGRAM_MINI_APP_URL",
                  ),
                },
              },
            ],
          ],
        );
      } catch (error: unknown) {
        if (error instanceof ApiException) {
          await this.telegramApi.sendMessage(
            message.chatId,
            "That connection link has expired or cannot be used. Create a new link in Drama Watch settings.",
            [
              [
                {
                  text: "Open settings",
                  url: `${this.configService.getOrThrow<string>("FRONTEND_URL")}/settings`,
                },
              ],
            ],
          );
          return;
        }

        throw error;
      }

      return;
    }

    await this.telegramApi.sendMessage(
      message.chatId,
      "Welcome to Drama Watch. Connect this bot from your website settings, then use the Mini App to search and track titles.",
      [
        [
          {
            text: "Open Drama Watch",
            web_app: {
              url: this.configService.getOrThrow<string>(
                "TELEGRAM_MINI_APP_URL",
              ),
            },
          },
        ],
      ],
    );
  }

  private verifySecret(value: string | undefined): void {
    const expected = this.configService.getOrThrow<string>(
      "TELEGRAM_WEBHOOK_SECRET",
    );

    if (!value || !safeEqual(value, expected)) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: "TELEGRAM_WEBHOOK_UNAUTHORIZED",
        message: "Telegram webhook authentication failed.",
      });
    }
  }
}

function parseUpdate(input: unknown): TelegramUpdate {
  if (!isRecord(input) || !Number.isInteger(input["update_id"])) {
    throw invalidTelegramUpdate();
  }

  const updateId = input["update_id"];
  const rawMessage = input["message"];

  if (!isRecord(rawMessage)) {
    return { updateId: updateId as number };
  }

  const chat = rawMessage["chat"];
  const from = rawMessage["from"];

  if (
    !isRecord(chat) ||
    !isRecord(from) ||
    !isTelegramId(chat["id"]) ||
    typeof chat["type"] !== "string" ||
    !isTelegramId(from["id"]) ||
    typeof from["first_name"] !== "string"
  ) {
    throw invalidTelegramUpdate();
  }

  const lastName =
    typeof from["last_name"] === "string" ? from["last_name"] : "";
  const username =
    typeof from["username"] === "string" ? from["username"] : undefined;
  const text =
    typeof rawMessage["text"] === "string"
      ? rawMessage["text"]
      : undefined;

  return {
    updateId: updateId as number,
    message: {
      chatId: String(chat["id"]),
      chatType: chat["type"],
      userId: String(from["id"]),
      displayName: `${from["first_name"]} ${lastName}`.trim(),
      ...(username === undefined ? {} : { username }),
      ...(text === undefined ? {} : { text }),
    },
  };
}

function readStartParameter(text: string | undefined): string | null {
  const match = text?.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/);
  return match?.[1]?.trim() ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTelegramId(value: unknown): value is string | number {
  return (
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && /^-?\d+$/.test(value))
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function invalidTelegramUpdate(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "TELEGRAM_UPDATE_INVALID",
    message: "Telegram update is invalid.",
  });
}

function telegramWebhookNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Resource not found.",
  });
}
