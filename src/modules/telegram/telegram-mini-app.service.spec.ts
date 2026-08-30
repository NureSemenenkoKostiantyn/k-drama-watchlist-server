import { jest } from "@jest/globals";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType, SearchMediaType } from "../../common/types/media.types";
import type { LibraryService } from "../library/library.service";
import type { MediaService } from "../media/media.service";
import type { TelegramMiniAppAuthService } from "./telegram-mini-app-auth.service";
import { TelegramMiniAppService } from "./telegram-mini-app.service";

describe("TelegramMiniAppService", () => {
  const initData = "auth_date=1&hash=signed";
  const userId = "507f1f77bcf86cd799439011";
  const resolveUserId = jest.fn<
    TelegramMiniAppAuthService["resolveUserId"]
  >(() => Promise.resolve(userId));
  const search = jest.fn<MediaService["search"]>();
  const list = jest.fn<LibraryService["list"]>();
  const add = jest.fn<LibraryService["add"]>();
  const updateStatus = jest.fn<LibraryService["updateStatus"]>();
  const updateProgress = jest.fn<LibraryService["updateProgress"]>();
  const service = new TelegramMiniAppService(
    { resolveUserId } as unknown as TelegramMiniAppAuthService,
    { search } as unknown as MediaService,
    { list, add, updateStatus, updateProgress } as unknown as LibraryService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveUserId.mockResolvedValue(userId);
  });

  it("authenticates before searching", async () => {
    const response = { page: 1, totalPages: 0, totalResults: 0, results: [] };
    search.mockResolvedValue(response);
    const query = { q: "Goblin", type: SearchMediaType.All, page: 1 };

    await expect(service.search(initData, query)).resolves.toBe(response);
    expect(resolveUserId).toHaveBeenCalledWith(initData);
    expect(search).toHaveBeenCalledWith(query);
  });

  it("uses the authenticated account for every library operation", async () => {
    const entry = { id: "entry-1" } as never;
    list.mockResolvedValue([entry]);
    add.mockResolvedValue(entry);
    updateStatus.mockResolvedValue(entry);
    updateProgress.mockResolvedValue(entry);

    await expect(service.listLibrary(initData)).resolves.toEqual([entry]);
    await expect(
      service.addToLibrary(initData, {
        mediaType: MediaType.Tv,
        tmdbId: 1396,
        status: WatchStatus.ToWatch,
      }),
    ).resolves.toBe(entry);
    await expect(
      service.updateStatus(initData, "entry-1", WatchStatus.Watching),
    ).resolves.toBe(entry);
    await expect(
      service.updateProgress(initData, "entry-1", {
        currentSeason: 1,
        currentEpisode: 2,
      }),
    ).resolves.toBe(entry);

    expect(list).toHaveBeenCalledWith(userId, undefined);
    expect(add).toHaveBeenCalledWith(userId, {
      mediaType: MediaType.Tv,
      tmdbId: 1396,
      status: WatchStatus.ToWatch,
    });
    expect(updateStatus).toHaveBeenCalledWith(
      userId,
      "entry-1",
      WatchStatus.Watching,
    );
    expect(updateProgress).toHaveBeenCalledWith(userId, "entry-1", {
      currentSeason: 1,
      currentEpisode: 2,
    });
  });
});
