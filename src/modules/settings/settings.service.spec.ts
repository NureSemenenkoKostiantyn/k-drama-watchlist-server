import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  ActivityVisibility,
  LibraryVisibility,
  TierBoardMode,
} from "../../common/types/settings.types";
import {
  type SettingsRepository,
  type StoredUserSettings,
} from "./settings.repository";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  const userId = new Types.ObjectId();
  const findByUserId = jest.fn<SettingsRepository["findByUserId"]>();
  const findByUserIds = jest.fn<SettingsRepository["findByUserIds"]>();
  const update = jest.fn<SettingsRepository["update"]>();
  const service = new SettingsService({
    findByUserId,
    findByUserIds,
    update,
  } as unknown as SettingsRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults missing settings to private without writing", async () => {
    findByUserId.mockResolvedValue(null);

    await expect(service.get(userId.toHexString())).resolves.toEqual({
      libraryVisibility: LibraryVisibility.Private,
      activityVisibility: ActivityVisibility.Private,
      tierBoardMode: TierBoardMode.All,
      telegramNotifications: {
        friendRequests: false,
        titleSuggestions: false,
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("persists and returns the selected visibility", async () => {
    update.mockResolvedValue(buildSettings(LibraryVisibility.Friends));

    await expect(
      service.update(userId.toHexString(), {
        libraryVisibility: LibraryVisibility.Friends,
        activityVisibility: ActivityVisibility.Friends,
      }),
    ).resolves.toEqual({
      libraryVisibility: LibraryVisibility.Friends,
      activityVisibility: ActivityVisibility.Friends,
      tierBoardMode: TierBoardMode.All,
      telegramNotifications: {
        friendRequests: false,
        titleSuggestions: false,
      },
    });
    expect(update).toHaveBeenCalledWith(userId, {
      libraryVisibility: LibraryVisibility.Friends,
      activityVisibility: ActivityVisibility.Friends,
    });
  });

  it("persists Telegram friend request notification consent", async () => {
    update.mockResolvedValue({
      ...buildSettings(LibraryVisibility.Private),
      telegramNotifications: {
        friendRequests: true,
        titleSuggestions: false,
      },
    });

    await expect(
      service.update(userId.toHexString(), {
        telegramNotifications: { friendRequests: true },
      }),
    ).resolves.toMatchObject({
      telegramNotifications: { friendRequests: true },
    });
    expect(update).toHaveBeenCalledWith(userId, {
      telegramNotifications: { friendRequests: true },
    });
  });

  it("persists the selected automatic tier-board mode", async () => {
    update.mockResolvedValue({
      ...buildSettings(LibraryVisibility.Private),
      tierBoardMode: TierBoardMode.Both,
    });
    await expect(
      service.update(userId.toHexString(), {
        tierBoardMode: TierBoardMode.Both,
      }),
    ).resolves.toMatchObject({ tierBoardMode: TierBoardMode.Both });
    expect(update).toHaveBeenCalledWith(userId, {
      tierBoardMode: TierBoardMode.Both,
    });
  });

  it("persists Telegram title suggestion notification consent", async () => {
    update.mockResolvedValue({
      ...buildSettings(LibraryVisibility.Private),
      telegramNotifications: {
        friendRequests: false,
        titleSuggestions: true,
      },
    });

    await expect(
      service.update(userId.toHexString(), {
        telegramNotifications: { titleSuggestions: true },
      }),
    ).resolves.toMatchObject({
      telegramNotifications: { titleSuggestions: true },
    });
    expect(update).toHaveBeenCalledWith(userId, {
      telegramNotifications: { titleSuggestions: true },
    });
  });

  it("selects only friends who opted into activity visibility", async () => {
    const privateUserId = new Types.ObjectId();
    findByUserIds.mockResolvedValue([
      buildSettings(LibraryVisibility.Private),
      {
        ...buildSettings(LibraryVisibility.Private),
        userId: privateUserId,
        activityVisibility: ActivityVisibility.Private,
      },
    ]);

    await expect(
      service.findVisibleFriendActivityUserIds([userId, privateUserId]),
    ).resolves.toEqual([userId]);
  });

  function buildSettings(
    libraryVisibility: LibraryVisibility,
  ): StoredUserSettings {
    return {
      _id: new Types.ObjectId(),
      userId,
      libraryVisibility,
      activityVisibility: ActivityVisibility.Friends,
      tierBoardMode: TierBoardMode.All,
      telegramNotifications: {
        friendRequests: false,
        titleSuggestions: false,
      },
      createdAt: new Date("2026-07-27T10:00:00.000Z"),
      updatedAt: new Date("2026-07-27T10:00:00.000Z"),
    };
  }
});
