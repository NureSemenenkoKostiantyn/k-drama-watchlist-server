import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { type Environment } from "../../config/environment";
import {
  type LibraryEntryResponse,
  WatchStatus,
} from "../../common/types/library.types";
import type { LibraryService } from "../library/library.service";
import type { TelegramApiService } from "./telegram-api.service";
import type { TelegramLinkService } from "./telegram-link.service";
import type { TelegramRepository } from "./telegram.repository";
import { TelegramUpdateService } from "./telegram-update.service";

describe("TelegramUpdateService", () => {
  const consumeLink = jest.fn<TelegramLinkService["consumeLink"]>();
  const claimUpdate = jest.fn<TelegramRepository["claimUpdate"]>();
  const releaseUpdate = jest.fn<TelegramRepository["releaseUpdate"]>();
  const findConnectionByTelegramUserId =
    jest.fn<TelegramRepository["findConnectionByTelegramUserId"]>();
  const listLibrary = jest.fn<LibraryService["list"]>();
  const sendMessage = jest.fn<TelegramApiService["sendMessage"]>();
  const linkService = {
    isEnabled: jest.fn(() => true),
    consumeLink,
  } as unknown as TelegramLinkService;
  const repository = {
    claimUpdate,
    releaseUpdate,
    findConnectionByTelegramUserId,
  } as unknown as TelegramRepository;
  const libraryService = {
    list: listLibrary,
  } as unknown as LibraryService;
  const telegramApi = { sendMessage } as unknown as TelegramApiService;
  const configService = {
    getOrThrow: jest.fn((key: keyof Environment) => {
      const values: Partial<Environment> = {
        TELEGRAM_WEBHOOK_SECRET:
          "telegram_webhook_secret_with_32_chars",
        TELEGRAM_MINI_APP_URL: "https://dahyun.best/telegram",
        FRONTEND_URL: "https://dahyun.best",
      };
      return values[key];
    }),
  } as unknown as ConfigService<Environment, true>;

  beforeEach(() => {
    jest.clearAllMocks();
    claimUpdate.mockResolvedValue(true);
    releaseUpdate.mockResolvedValue(undefined);
    consumeLink.mockResolvedValue({ enabled: true, connected: true });
    findConnectionByTelegramUserId.mockResolvedValue(null);
    listLibrary.mockResolvedValue([]);
    sendMessage.mockResolvedValue(undefined);
  });

  it("rejects a webhook with the wrong secret before claiming the update", async () => {
    const service = createService();

    await expect(service.handle("wrong", { update_id: 1 })).rejects.toMatchObject({
      code: "TELEGRAM_WEBHOOK_UNAUTHORIZED",
    });
    expect(claimUpdate).not.toHaveBeenCalled();
  });

  it("consumes a private-chat account link and sends the Mini App button", async () => {
    const service = createService();

    await service.handle("telegram_webhook_secret_with_32_chars", {
      update_id: 42,
      message: {
        text: "/start link_single_use_token",
        chat: { id: 123456, type: "private" },
        from: {
          id: 123456,
          first_name: "Demo",
          last_name: "Viewer",
          username: "viewer",
        },
      },
    });

    expect(consumeLink).toHaveBeenCalledWith("single_use_token", {
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramUsername: "viewer",
      telegramDisplayName: "Demo Viewer",
    });
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Telegram is connected to your Drama Watch account.",
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("ignores an update that has already been claimed", async () => {
    claimUpdate.mockResolvedValue(false);
    const service = createService();

    await service.handle("telegram_webhook_secret_with_32_chars", {
      update_id: 42,
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("opens the Mini App for a connected account", async () => {
    findConnectionByTelegramUserId.mockResolvedValue({
      userId: new Types.ObjectId("507f1f77bcf86cd799439011"),
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(43, "/app"),
    );

    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Open Drama Watch to search titles, update progress and manage your watchlist.",
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("directs an unconnected account to website settings", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(44, "/app@dahyun_best_bot"),
    );

    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      expect.stringContaining("not connected"),
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );
  });

  it("makes the default start response connection-aware", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(47, "/start"),
    );
    expect(sendMessage).toHaveBeenLastCalledWith(
      "123456",
      expect.stringContaining("not connected"),
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );

    findConnectionByTelegramUserId.mockResolvedValue({
      userId: new Types.ObjectId("507f1f77bcf86cd799439011"),
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(48, "/start"),
    );
    expect(sendMessage).toHaveBeenLastCalledWith(
      "123456",
      expect.stringContaining("Welcome back"),
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("returns concise help and supports the settings command", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(45, "/help"),
    );
    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(46, "/settings"),
    );

    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      "123456",
      expect.stringContaining("/watching — See what you are watching"),
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      "123456",
      "Manage your Telegram connection from Drama Watch Settings.",
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );
  });

  it("lists the connected account's currently watching titles", async () => {
    const userId = new Types.ObjectId("507f1f77bcf86cd799439011");
    findConnectionByTelegramUserId.mockResolvedValue({
      userId,
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    listLibrary.mockResolvedValue([
      {
        media: { title: "Goblin" },
        progress: { currentSeason: 1, currentEpisode: 7 },
      },
      { media: { title: "Parasite" } },
    ] as LibraryEntryResponse[]);
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(49, "/watching"),
    );

    expect(listLibrary).toHaveBeenCalledWith(
      userId.toHexString(),
      WatchStatus.Watching,
    );
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Currently watching (2)\n\n1. Goblin — S1 E7\n2. Parasite",
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("does not read a library for an unconnected watching command", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(50, "/watching"),
    );

    expect(listLibrary).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      expect.stringContaining("not connected"),
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );
  });

  it("bounds long watching summaries to a Telegram-safe preview", async () => {
    findConnectionByTelegramUserId.mockResolvedValue({
      userId: new Types.ObjectId("507f1f77bcf86cd799439011"),
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    listLibrary.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => ({
        media: { title: `Title ${index + 1}` },
      })) as LibraryEntryResponse[],
    );
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(51, "/watching"),
    );

    const text = sendMessage.mock.calls[0]?.[1];
    expect(text).toContain("12. Title 12");
    expect(text).toContain("And 1 more in the Mini App.");
    expect(text).not.toContain("13. Title 13");
  });

  function createService(): TelegramUpdateService {
    return new TelegramUpdateService(
      configService,
      linkService,
      repository,
      libraryService,
      telegramApi,
    );
  }

  function createMessageUpdate(updateId: number, text: string) {
    return {
      update_id: updateId,
      message: {
        text,
        chat: { id: 123456, type: "private" },
        from: {
          id: 123456,
          first_name: "Demo",
          last_name: "Viewer",
          username: "viewer",
        },
      },
    };
  }
});
