import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  type CategoriesRepository,
  type StoredCategory,
} from "./categories.repository";
import {
  CategoriesService,
  slugifyCategoryName,
} from "./categories.service";

describe("CategoriesService", () => {
  const findAll = jest.fn<CategoriesRepository["findAll"]>();
  const findByIds = jest.fn<CategoriesRepository["findByIds"]>();
  const create = jest.fn<CategoriesRepository["create"]>();
  const update = jest.fn<CategoriesRepository["update"]>();
  const deleteCategory =
    jest.fn<CategoriesRepository["delete"]>();
  const service = new CategoriesService({
    findAll,
    findByIds,
    create,
    update,
    delete: deleteCategory,
  } as unknown as CategoriesRepository);
  const userId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();
  const now = new Date("2026-07-24T10:00:00.000Z");
  const category: StoredCategory = {
    _id: categoryId,
    userId,
    name: "Comfort drama",
    slug: "comfort-drama",
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a normalized owner-scoped category", async () => {
    create.mockResolvedValue(category);

    await expect(
      service.create(userId.toHexString(), {
        name: "Comfort drama",
        icon: "  heart  ",
      }),
    ).resolves.toEqual({
      id: categoryId.toHexString(),
      name: "Comfort drama",
      slug: "comfort-drama",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    expect(create).toHaveBeenCalledWith(
      userId,
      "Comfort drama",
      "comfort-drama",
      "heart",
    );
  });

  it("preserves international letters while generating slugs", () => {
    expect(slugifyCategoryName("Українські Драми")).toBe(
      "українські-драми",
    );
    expect(slugifyCategoryName("Café & Comfort")).toBe(
      "café-comfort",
    );
  });

  it("rejects names that cannot produce a stable slug", async () => {
    await expect(
      service.create(userId.toHexString(), {
        name: "✨",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects category IDs that do not all belong to the user", async () => {
    const unavailableId = new Types.ObjectId();
    findByIds.mockResolvedValue([category]);

    await expect(
      service.resolveOwnedIds(userId.toHexString(), [
        categoryId.toHexString(),
        unavailableId.toHexString(),
      ]),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("deduplicates category assignments without changing their order", async () => {
    findByIds.mockResolvedValue([category]);

    await expect(
      service.resolveOwnedIds(userId.toHexString(), [
        categoryId.toHexString(),
        categoryId.toHexString(),
      ]),
    ).resolves.toEqual([categoryId]);
  });
});
