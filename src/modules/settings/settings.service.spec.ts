import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  ActivityVisibility,
  LibraryVisibility,
} from "../../common/types/settings.types";
import {
  type SettingsRepository,
  type StoredUserSettings,
} from "./settings.repository";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  const userId = new Types.ObjectId();
  const findByUserId =
    jest.fn<SettingsRepository["findByUserId"]>();
  const findByUserIds =
    jest.fn<SettingsRepository["findByUserIds"]>();
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
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("persists and returns the selected visibility", async () => {
    update.mockResolvedValue(
      buildSettings(LibraryVisibility.Friends),
    );

    await expect(
      service.update(userId.toHexString(), {
        libraryVisibility: LibraryVisibility.Friends,
        activityVisibility: ActivityVisibility.Friends,
      }),
    ).resolves.toEqual({
      libraryVisibility: LibraryVisibility.Friends,
      activityVisibility: ActivityVisibility.Friends,
    });
    expect(update).toHaveBeenCalledWith(
      userId,
      {
        libraryVisibility: LibraryVisibility.Friends,
        activityVisibility: ActivityVisibility.Friends,
      },
    );
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
      createdAt: new Date("2026-07-27T10:00:00.000Z"),
      updatedAt: new Date("2026-07-27T10:00:00.000Z"),
    };
  }
});
