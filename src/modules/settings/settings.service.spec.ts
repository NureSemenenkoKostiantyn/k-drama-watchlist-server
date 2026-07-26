import { jest } from "@jest/globals";
import { Types } from "mongoose";

import { LibraryVisibility } from "../../common/types/settings.types";
import {
  type SettingsRepository,
  type StoredUserSettings,
} from "./settings.repository";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  const userId = new Types.ObjectId();
  const findByUserId =
    jest.fn<SettingsRepository["findByUserId"]>();
  const update = jest.fn<SettingsRepository["update"]>();
  const service = new SettingsService({
    findByUserId,
    update,
  } as unknown as SettingsRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults missing settings to private without writing", async () => {
    findByUserId.mockResolvedValue(null);

    await expect(service.get(userId.toHexString())).resolves.toEqual({
      libraryVisibility: LibraryVisibility.Private,
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
      }),
    ).resolves.toEqual({
      libraryVisibility: LibraryVisibility.Friends,
    });
    expect(update).toHaveBeenCalledWith(
      userId,
      LibraryVisibility.Friends,
    );
  });

  function buildSettings(
    libraryVisibility: LibraryVisibility,
  ): StoredUserSettings {
    return {
      _id: new Types.ObjectId(),
      userId,
      libraryVisibility,
      createdAt: new Date("2026-07-27T10:00:00.000Z"),
      updatedAt: new Date("2026-07-27T10:00:00.000Z"),
    };
  }
});
