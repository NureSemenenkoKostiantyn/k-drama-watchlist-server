import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { type Environment } from "../../config/environment";
import {
  type LibraryEntryResponse,
  WatchStatus,
} from "../../common/types/library.types";
import { MediaType, SearchMediaType } from "../../common/types/media.types";
import {
  WheelRole,
  WheelSelectionMode,
  WheelVisibility,
} from "../../common/types/wheel.types";
import type { LibraryService } from "../library/library.service";
import type { MediaService } from "../media/media.service";
import type { WheelsService } from "../wheels/wheels.service";
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
  const getLibraryEntry = jest.fn<LibraryService["get"]>();
  const updateLibraryProgress = jest.fn<LibraryService["updateProgress"]>();
  const searchMedia = jest.fn<MediaService["search"]>();
  const listWheels = jest.fn<WheelsService["list"]>();
  const spinWheel = jest.fn<WheelsService["spin"]>();
  const sendMessage = jest.fn<TelegramApiService["sendMessage"]>();
  const answerCallbackQuery =
    jest.fn<TelegramApiService["answerCallbackQuery"]>();
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
    get: getLibraryEntry,
    updateProgress: updateLibraryProgress,
  } as unknown as LibraryService;
  const mediaService = {
    search: searchMedia,
  } as unknown as MediaService;
  const wheelsService = {
    list: listWheels,
    spin: spinWheel,
  } as unknown as WheelsService;
  const telegramApi = {
    sendMessage,
    answerCallbackQuery,
  } as unknown as TelegramApiService;
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
    listWheels.mockResolvedValue([]);
    sendMessage.mockResolvedValue(undefined);
    answerCallbackQuery.mockResolvedValue(undefined);
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

  it("offers owner-scoped episode increment buttons for watching TV titles", async () => {
    findConnectionByTelegramUserId.mockResolvedValue(connectedAccount());
    listLibrary.mockResolvedValue([
      libraryEntry({
        id: "507f1f77bcf86cd799439012",
        title: "Goblin",
        progress: { currentSeason: 1, currentEpisode: 7 },
      }),
      libraryEntry({
        id: "507f1f77bcf86cd799439013",
        title: "Parasite",
        mediaType: MediaType.Movie,
      }),
    ]);
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(56, "/progress"),
    );

    expect(listLibrary).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      WatchStatus.Watching,
    );
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Choose a title to mark its next episode watched:",
      [
        [
          {
            text: "+1 · Goblin · S1 E7",
            callback_data: "progress:507f1f77bcf86cd799439012",
          },
        ],
        [{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }],
      ],
    );
  });

  it("increments the selected owner's title from a Telegram callback", async () => {
    findConnectionByTelegramUserId.mockResolvedValue(connectedAccount());
    getLibraryEntry.mockResolvedValue(
      libraryEntry({
        id: "507f1f77bcf86cd799439012",
        title: "Goblin",
        progress: { currentSeason: 1, currentEpisode: 7 },
      }),
    );
    updateLibraryProgress.mockResolvedValue(
      libraryEntry({
        id: "507f1f77bcf86cd799439012",
        title: "Goblin",
        progress: { currentSeason: 1, currentEpisode: 8 },
      }),
    );
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createCallbackUpdate(57, "progress:507f1f77bcf86cd799439012"),
    );

    expect(getLibraryEntry).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
    );
    expect(updateLibraryProgress).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
      { currentSeason: 1, currentEpisode: 8, includeSpecials: false },
    );
    expect(answerCallbackQuery).toHaveBeenCalledWith(
      "callback-57",
      "Goblin: S1 E8",
    );
  });

  it("does not mutate progress for an unconnected callback identity", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createCallbackUpdate(58, "progress:507f1f77bcf86cd799439012"),
    );

    expect(getLibraryEntry).not.toHaveBeenCalled();
    expect(updateLibraryProgress).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith(
      "callback-58",
      "Connect your Drama Watch account first.",
    );
  });

  it("offers only wheels the connected account can spin", async () => {
    findConnectionByTelegramUserId.mockResolvedValue(connectedAccount());
    listWheels.mockResolvedValue([
      wheel({
        id: "507f1f77bcf86cd799439021",
        title: "Friday night",
        role: WheelRole.Owner,
        enabledItemCount: 3,
      }),
      wheel({
        id: "507f1f77bcf86cd799439022",
        title: "Shared picks",
        role: WheelRole.Editor,
        enabledItemCount: 1,
      }),
      wheel({
        id: "507f1f77bcf86cd799439023",
        title: "View only",
        role: WheelRole.Viewer,
        enabledItemCount: 5,
      }),
      wheel({
        id: "507f1f77bcf86cd799439024",
        title: "Empty",
        role: WheelRole.Owner,
        enabledItemCount: 0,
      }),
    ]);
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(59, "/random"),
    );

    expect(listWheels).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Choose a wheel to pick and record a random title:",
      [
        [
          {
            text: "🎲 Friday night · 3 titles",
            callback_data: "random:507f1f77bcf86cd799439021",
          },
        ],
        [
          {
            text: "🎲 Shared picks · 1 title",
            callback_data: "random:507f1f77bcf86cd799439022",
          },
        ],
        [{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }],
      ],
    );
  });

  it("spins and persists the selected owner-accessible wheel", async () => {
    findConnectionByTelegramUserId.mockResolvedValue(connectedAccount());
    spinWheel.mockResolvedValue({
      spinId: "507f1f77bcf86cd799439031",
      selectedItem: {
        wheelItemId: "507f1f77bcf86cd799439032",
        mediaId: "507f1f77bcf86cd799439033",
        title: "Crash Landing on You",
      },
      createdAt: "2026-09-04T12:00:00.000Z",
    });
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createCallbackUpdate(60, "random:507f1f77bcf86cd799439021"),
    );

    expect(spinWheel).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439021",
    );
    expect(answerCallbackQuery).toHaveBeenCalledWith(
      "callback-60",
      "Picked: Crash Landing on You",
    );
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "🎲 The wheel picked Crash Landing on You.",
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("does not list wheels for an unconnected random command", async () => {
    const service = createService();

    await service.handle(
      "telegram_webhook_secret_with_32_chars",
      createMessageUpdate(61, "/random"),
    );

    expect(listWheels).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      expect.stringContaining("not connected"),
      [[{ text: "Open Settings", url: "https://dahyun.best/settings" }]],
    );
  });

  function createService(): TelegramUpdateService {
    return new TelegramUpdateService(
      configService,
      linkService,
      repository,
      libraryService,
      mediaService,
      wheelsService,
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

  function createCallbackUpdate(updateId: number, data: string) {
    return {
      update_id: updateId,
      callback_query: {
        id: `callback-${updateId}`,
        data,
        from: { id: 123456, first_name: "Demo" },
        message: { chat: { id: 123456, type: "private" } },
      },
    };
  }

  function connectedAccount() {
    return {
      userId: new Types.ObjectId("507f1f77bcf86cd799439011"),
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramDisplayName: "Demo Viewer",
      linkedAt: new Date("2026-08-30T12:00:00.000Z"),
    };
  }

  function libraryEntry(input: {
    id: string;
    title: string;
    mediaType?: MediaType;
    progress?: { currentSeason: number; currentEpisode: number };
  }): LibraryEntryResponse {
    const progress = input.progress;
    return {
      id: input.id,
      mediaId: "507f1f77bcf86cd799439099",
      status: WatchStatus.Watching,
      media: {
        id: "tv:1396",
        tmdbId: 1396,
        mediaType: input.mediaType ?? MediaType.Tv,
        title: input.title,
        originalTitle: input.title,
        originCountry: ["KR"],
        genreIds: [],
        seasons: [{ seasonNumber: 1, name: "Season 1", episodeCount: 16 }],
      },
      ...(progress
        ? {
            progress: {
              ...progress,
              completedEpisodes: progress.currentEpisode,
              completedSeasonNumbers: [],
              includeSpecials: false,
              updatedAt: "2026-09-04T12:00:00.000Z",
            },
          }
        : {}),
      categoryIds: [],
      sharedLists: [],
      createdAt: "2026-09-04T12:00:00.000Z",
      updatedAt: "2026-09-04T12:00:00.000Z",
    };
  }

  function wheel(input: {
    id: string;
    title: string;
    role: WheelRole;
    enabledItemCount: number;
  }) {
    return {
      ...input,
      visibility: WheelVisibility.Private,
      selectionMode: WheelSelectionMode.FullyRandom,
      itemCount: input.enabledItemCount,
      createdAt: "2026-09-04T12:00:00.000Z",
      updatedAt: "2026-09-04T12:00:00.000Z",
    };
  }
});
