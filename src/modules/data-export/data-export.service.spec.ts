import { jest } from "@jest/globals";
import { ObjectId } from "mongodb";

import { WatchStatus } from "../../common/types/library.types";
import { MediaType } from "../../common/types/media.types";
import {
  ActivityVisibility,
  LibraryVisibility,
} from "../../common/types/settings.types";
import { type CategoriesService } from "../categories/categories.service";
import { type LibraryService } from "../library/library.service";
import { type PriorityRepository } from "../priority/priority.repository";
import { type SettingsService } from "../settings/settings.service";
import { type DataExportRepository } from "./data-export.repository";
import { DataExportService } from "./data-export.service";

describe("DataExportService", () => {
  it("builds a versioned owner archive without authentication secrets", async () => {
    const userId = new ObjectId();
    const laneId = new ObjectId();
    const createdAt = new Date("2026-01-02T03:04:05.000Z");
    const updatedAt = new Date("2026-02-03T04:05:06.000Z");
    const findAccountById = jest.fn<
      DataExportRepository["findAccountById"]
    >();
    const getSettings = jest.fn<SettingsService["get"]>();
    const listCategories = jest.fn<CategoriesService["list"]>();
    const findPriorityLanes = jest.fn<PriorityRepository["findAll"]>();
    const listLibrary = jest.fn<LibraryService["list"]>();
    const repository = {
      findAccountById: findAccountById.mockResolvedValue({
        _id: userId,
        email: "owner@example.com",
        emailVerified: true,
        name: "Owner",
        username: "owner",
        displayUsername: "Owner",
        image: null,
        createdAt,
        updatedAt,
      }),
    };
    const settings = {
      get: getSettings.mockResolvedValue({
        libraryVisibility: LibraryVisibility.Private,
        activityVisibility: ActivityVisibility.Friends,
      }),
    };
    const categories = {
      list: listCategories.mockResolvedValue([
        {
          id: "category-1",
          name: "Comfort",
          slug: "comfort",
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ]),
    };
    const priority = {
      findAll: findPriorityLanes.mockResolvedValue([
        {
          _id: laneId,
          userId,
          name: "Must watch",
          position: 0,
          isDefault: true,
          createdAt,
          updatedAt,
        },
      ]),
    };
    const library = {
      list: listLibrary.mockResolvedValue([
        {
          id: "entry-1",
          mediaId: "media-1",
          status: WatchStatus.ToWatch,
          categoryIds: ["category-1"],
          sharedLists: [],
          description: "Private note",
          media: {
            id: "tv:1",
            tmdbId: 1,
            mediaType: MediaType.Tv,
            title: "Goblin",
            originalTitle: "Goblin",
            originCountry: ["KR"],
            genreIds: [18],
          },
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ]),
    };
    const service = new DataExportService(
      repository as unknown as DataExportRepository,
      settings as unknown as SettingsService,
      categories as unknown as CategoriesService,
      priority as unknown as PriorityRepository,
      library as unknown as LibraryService,
    );

    const result = await service.exportAccount(userId.toHexString());

    expect(result).toMatchObject({
      format: "drama-watch-account-export",
      version: 1,
      account: {
        id: userId.toHexString(),
        email: "owner@example.com",
        emailVerified: true,
        username: "owner",
      },
      settings: {
        libraryVisibility: "private",
        activityVisibility: "friends",
      },
      priorityLanes: [
        {
          id: laneId.toHexString(),
          name: "Must watch",
        },
      ],
      library: [{ description: "Private note" }],
    });
    expect(Object.keys(result.account)).not.toContain("password");
    expect(findAccountById).toHaveBeenCalledWith(userId);
  });
});
