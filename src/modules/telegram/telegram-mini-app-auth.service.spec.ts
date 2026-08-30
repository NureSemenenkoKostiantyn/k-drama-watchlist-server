import { createHmac } from "node:crypto";

import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { type Environment } from "../../config/environment";
import type { UsersService } from "../users/users.service";
import type { TelegramLinkService } from "./telegram-link.service";
import {
  TelegramMiniAppAuthService,
  validateTelegramInitData,
} from "./telegram-mini-app-auth.service";
import type { TelegramRepository } from "./telegram.repository";

describe("TelegramMiniAppAuthService", () => {
  const botToken = "123456:telegram-bot-token";
  const now = new Date("2026-08-30T14:00:00.000Z");

  it("validates signed, fresh Telegram init data", () => {
    const initData = signInitData(
      {
        auth_date: String(Math.floor(now.getTime() / 1_000)),
        query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
        user: JSON.stringify({ id: 123_456, first_name: "Demo" }),
      },
      botToken,
    );

    expect(validateTelegramInitData(initData, botToken, 300, now)).toEqual({
      id: "123456",
    });
  });

  it("rejects data signed with another bot token", () => {
    const initData = signInitData(
      {
        auth_date: String(Math.floor(now.getTime() / 1_000)),
        user: JSON.stringify({ id: 123_456 }),
      },
      "999999:another-token",
    );

    expect(() =>
      validateTelegramInitData(initData, botToken, 300, now),
    ).toThrow("Telegram Mini App authentication failed.");
  });

  it("rejects replayed init data outside the freshness window", () => {
    const initData = signInitData(
      {
        auth_date: String(Math.floor(now.getTime() / 1_000) - 301),
        user: JSON.stringify({ id: 123_456 }),
      },
      botToken,
    );

    expect(() =>
      validateTelegramInitData(initData, botToken, 300, now),
    ).toThrow("Reopen the Mini App from Telegram to continue.");
  });

  it("resolves only a linked Telegram identity to the Drama Watch account", async () => {
    const userId = new Types.ObjectId();
    const currentTime = new Date();
    const initData = signInitData(
      {
        auth_date: String(Math.floor(currentTime.getTime() / 1_000)),
        user: JSON.stringify({ id: 123_456 }),
      },
      botToken,
    );
    const repository = {
      findConnectionByTelegramUserId: jest.fn(() =>
        Promise.resolve({
          userId,
          telegramUserId: "123456",
          privateChatId: "123456",
          telegramUsername: "demo_viewer",
          telegramDisplayName: "Demo Viewer",
          linkedAt: now,
        }),
      ),
    } as unknown as TelegramRepository;
    const getById = jest.fn<UsersService["getById"]>(() =>
      Promise.resolve({
        id: userId.toHexString(),
        username: "demo_viewer",
        displayUsername: "Demo_Viewer",
        name: "Demo Viewer",
        joinedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const usersService = { getById } as unknown as UsersService;
    const service = new TelegramMiniAppAuthService(
      configService(botToken),
      { isEnabled: () => true } as TelegramLinkService,
      repository,
      usersService,
    );

    await expect(service.authenticate(initData)).resolves.toMatchObject({
      account: { username: "demo_viewer" },
      telegramDisplayName: "Demo Viewer",
      telegramUsername: "demo_viewer",
    });
    expect(getById).toHaveBeenCalledWith(userId.toHexString());
  });

  it("does not authenticate a valid Telegram identity before account linking", async () => {
    const currentTime = new Date();
    const initData = signInitData(
      {
        auth_date: String(Math.floor(currentTime.getTime() / 1_000)),
        user: JSON.stringify({ id: 123_456 }),
      },
      botToken,
    );
    const service = new TelegramMiniAppAuthService(
      configService(botToken),
      { isEnabled: () => true } as TelegramLinkService,
      {
        findConnectionByTelegramUserId: jest.fn(() => Promise.resolve(null)),
      } as unknown as TelegramRepository,
      {} as UsersService,
    );

    await expect(service.authenticate(initData)).rejects.toMatchObject({
      code: "TELEGRAM_ACCOUNT_NOT_LINKED",
    });
  });

  function configService(token: string): ConfigService<Environment, true> {
    const values: Partial<Environment> = {
      TELEGRAM_BOT_TOKEN: token,
      TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 300,
    };
    return {
      getOrThrow: jest.fn((key: keyof Environment) => values[key]),
    } as unknown as ConfigService<Environment, true>;
  }
});

function signInitData(
  values: Record<string, string>,
  botToken: string,
): string {
  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const parameters = new URLSearchParams(values);
  parameters.set("hash", hash);
  return parameters.toString();
}
