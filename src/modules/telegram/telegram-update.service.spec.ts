import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { type Environment } from "../../config/environment";
import {
  type LibraryEntryResponse,
  WatchStatus,
} from "../../common/types/library.types";
import { MediaType, SearchMediaType } from "../../common/types/media.types";
import type { LibraryService } from "../library/library.service";
import type { MediaService } from "../media/media.service";
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
  const searchMedia = jest.fn<MediaService["search"]>();
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
  const mediaService = {
    search: searchMedia,
  } as unknown as MediaService;
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
    searchMedia.mockResolvedValue({
      page: 1,
      totalPages: 0,
      totalResults: 0,
      results: [],
    });
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

  it("searches TMDB for a connected account and returns bounded results", async () => {
    findConnectionByTelegramUserId.mockResolvedValue({
      userId: new Types.ObjectId("507f1f77bcf86cd799439011"),
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    searchMedia.mockResolvedValue({
      page: 1,
      totalPages: 2,
      totalResults: 9,
      results: Array.from({ length: 9 }, (_, index) => ({
        id: `tv:${index + 1}`,
        tmdbId: index + 1,
        mediaType: index === 1 ? MediaType.Movie : MediaType.Tv,
        title: index === 0 ? "Goblin" : `Result ${index + 1}`,
        originalTitle: index === 0 ? "쓸쓸하고 찬란하神 – 도깨비" : `Result ${index + 1}`,
        firstAirDate: index === 0 ? "2016-12-02" : undefined,
        releaseDate: index === 1 ? "2019-05-30" : undefined,
        originCountry: [],
        genreIds: [],
      })),
    });
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(52, "/search Goblin"),
    );

    expect(searchMedia).toHaveBeenCalledWith({
      q: "Goblin",
      type: SearchMediaType.All,
      page: 1,
    });
    const text = sendMessage.mock.calls[0]?.[1];
    expect(text).toContain("Search results for “Goblin”");
    expect(text).toContain("1. Goblin (2016) — TV");
    expect(text).toContain("2. Result 2 (2019) — Movie");
    expect(text).toContain("1 more result available.");
    expect(text).not.toContain("9. Result 9");
  });

  it("shows search usage without calling TMDB when the query is missing", async () => {
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
      createMessageUpdate(53, "/search"),
    );

    expect(searchMedia).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      expect.stringContaining("/search Goblin"),
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("does not search TMDB for an unconnected account", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(54, "/search Goblin"),
    );

    expect(searchMedia).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      expect.stringContaining("not connected"),
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );
  });

  it("returns an empty search result without exposing internal data", async () => {
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
      createMessageUpdate(55, "/search Unknown title"),
    );

    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "No titles found for “Unknown title”. Try another title or search in the Mini App.",
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  function createService(): TelegramUpdateService {
    return new TelegramUpdateService(
      configService,
      linkService,
      repository,
      libraryService,
      mediaService,
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
