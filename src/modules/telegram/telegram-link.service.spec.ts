import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { type Environment } from "../../config/environment";
import { TelegramLinkService } from "./telegram-link.service";
import type { TelegramRepository } from "./telegram.repository";

describe("TelegramLinkService", () => {
  const userId = new Types.ObjectId();
  const saveLinkToken = jest.fn<TelegramRepository["saveLinkToken"]>();
  const disconnect = jest.fn<TelegramRepository["disconnect"]>();
  const findConnectionByUserId =
    jest.fn<TelegramRepository["findConnectionByUserId"]>();
  const consumeLinkToken =
    jest.fn<TelegramRepository["consumeLinkToken"]>();
  const connect = jest.fn<TelegramRepository["connect"]>();
  const repository = {
    saveLinkToken,
    disconnect,
    findConnectionByUserId,
    consumeLinkToken,
    connect,
  } as unknown as TelegramRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    saveLinkToken.mockResolvedValue(undefined);
    disconnect.mockResolvedValue(true);
    findConnectionByUserId.mockResolvedValue(null);
  });

  it("keeps connection state unavailable when Telegram is disabled", async () => {
    const service = createService({ TELEGRAM_ENABLED: false });

    await expect(service.getConnection(userId.toHexString())).resolves.toEqual({
      enabled: false,
      connected: false,
    });
    await expect(service.createLink(userId.toHexString())).rejects.toMatchObject({
      code: "TELEGRAM_NOT_CONFIGURED",
    });
  });

  it("creates a short-lived deep link while storing only the token hash", async () => {
    const service = createService();
    const response = await service.createLink(userId.toHexString());
    const linkToken = new URL(response.deepLink).searchParams
      .get("start")
      ?.replace(/^link_/, "");

    expect(response.deepLink).toMatch(
      /^https:\/\/t\.me\/DramaWatchBot\?start=link_[A-Za-z0-9_-]+$/,
    );
    expect(linkToken).toBeDefined();
    expect(saveLinkToken).toHaveBeenCalledWith(
      userId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(saveLinkToken.mock.calls[0]?.[1]).not.toContain(linkToken);
    expect(new Date(response.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns the linked Telegram profile without exposing Telegram ids", async () => {
    findConnectionByUserId.mockResolvedValue({
      userId,
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramUsername: "viewer",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    const service = createService();

    await expect(service.getConnection(userId.toHexString())).resolves.toEqual({
      enabled: true,
      connected: true,
      botUsername: "DramaWatchBot",
      miniAppUrl: "https://dahyun.best/telegram",
      telegramUsername: "viewer",
      telegramDisplayName: "Demo Viewer",
      connectedAt: "2026-08-30T12:00:00.000Z",
    });
  });

  function createService(
    overrides: Partial<Environment> = {},
  ): TelegramLinkService {
    const values: Partial<Environment> = {
      TELEGRAM_ENABLED: true,
      TELEGRAM_BOT_USERNAME: "DramaWatchBot",
      TELEGRAM_MINI_APP_URL: "https://dahyun.best/telegram",
      TELEGRAM_LINK_TTL_MINUTES: 10,
      ...overrides,
    };
    const configService = {
      getOrThrow: jest.fn((key: keyof Environment) => values[key]),
    } as unknown as ConfigService<Environment, true>;

    return new TelegramLinkService(configService, repository);
  }
});
