import { jest } from "@jest/globals";
import { Types } from "mongoose";
import { MediaType } from "../../common/types/media.types";
import {
  TierColor,
  TierListVisibility,
} from "../../common/types/tier-list.types";
import {
  type MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { type MediaService } from "../media/media.service";
import { type UsersService } from "../users/users.service";
import { type TierListDocument } from "./schema/tier-list.schema";
import { type TierListsRepository } from "./tier-lists.repository";
import { TierListsService } from "./tier-lists.service";

describe("TierListsService", () => {
  const owner = new Types.ObjectId();
  const first = media(1);
  const second = media(2);
  const repository = {
    list: jest.fn<TierListsRepository["list"]>(),
    create: jest.fn<TierListsRepository["create"]>(),
    findOwned: jest.fn<TierListsRepository["findOwned"]>(),
    findPublic: jest.fn<TierListsRepository["findPublic"]>(),
    save: jest.fn<TierListsRepository["save"]>(),
    delete: jest.fn<TierListsRepository["delete"]>(),
  };
  const mediaRepository = {
    findByIds: jest.fn<MediaRepository["findByIds"]>(),
    findByIdentity: jest.fn<MediaRepository["findByIdentity"]>(),
    upsertSnapshot: jest.fn<MediaRepository["upsertSnapshot"]>(),
  };
  const mediaService = { getDetails: jest.fn<MediaService["getDetails"]>() };
  const usersService = {
    findStoredByIds: jest.fn<UsersService["findStoredByIds"]>(),
  };
  const service = new TierListsService(
    repository as unknown as TierListsRepository,
    mediaRepository as unknown as MediaRepository,
    mediaService as unknown as MediaService,
    usersService as unknown as UsersService,
  );
  let board: TierListDocument;

  beforeEach(() => {
    jest.resetAllMocks();
    board = {
      _id: new Types.ObjectId(),
      ownerId: owner,
      title: "Favourite dramas",
      description: "Ranked titles",
      visibility: TierListVisibility.Private,
      revision: 3,
      tiers: [
        { id: "s", label: "S", color: TierColor.Red, mediaIds: [first._id] },
        { id: "a", label: "A", color: TierColor.Yellow, mediaIds: [] },
      ],
      unrankedMediaIds: [second._id],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repository.findOwned.mockResolvedValue(board);
    repository.save.mockImplementation((value) =>
      Promise.resolve({ ...value, revision: value.revision + 1 }),
    );
    repository.create.mockImplementation((value) =>
      Promise.resolve({
        ...value,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    mediaRepository.findByIds.mockImplementation((ids) =>
      Promise.resolve(
        [first, second].filter((item) => ids.some((id) => id.equals(item._id))),
      ),
    );
    mediaRepository.findByIdentity.mockImplementation((_type, tmdbId) =>
      Promise.resolve(
        [first, second].find((item) => item.tmdbId === tmdbId) ?? null,
      ),
    );
    usersService.findStoredByIds.mockResolvedValue([]);
  });

  it("creates private S–F tiers without touching the library or media", async () => {
    const result = await service.create(owner.toHexString(), {
      title: "My ranking",
    });
    expect(result.visibility).toBe("private");
    expect(result.revision).toBe(0);
    expect(result.tiers.map((row) => row.label)).toEqual([
      "S",
      "A",
      "B",
      "C",
      "D",
      "F",
    ]);
    expect(new Set(result.tiers.map((row) => row.id)).size).toBe(6);
    expect(result.unranked).toEqual([]);
    expect(mediaService.getDetails).not.toHaveBeenCalled();
  });

  it("scopes owner lookups and hides another user's board", async () => {
    repository.findOwned.mockResolvedValue(null);
    await expect(
      service.get(owner.toHexString(), board._id.toHexString()),
    ).rejects.toMatchObject({ code: "TIER_LIST_NOT_FOUND" });
    expect(repository.findOwned).toHaveBeenCalledWith(
      board._id.toHexString(),
      owner,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("moves across tiers with one complete save", async () => {
    const result = await service.layout(
      owner.toHexString(),
      board._id.toHexString(),
      {
        revision: 3,
        tiers: [
          {
            id: "a",
            label: "Great",
            color: TierColor.Green,
            mediaIds: ["tv:2", "tv:1"],
          },
        ],
        unrankedMediaIds: [],
      },
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.revision).toBe(4);
    expect(result.tiers[0]?.items.map((item) => item.id)).toEqual([
      "tv:2",
      "tv:1",
    ]);
    expect(result.unranked).toEqual([]);
  });

  it.each([
    [["tv:1"], []],
    [["tv:1", "tv:1"], []],
    [["tv:1"], ["tv:3"]],
    [["tv:1", "tv:2"], ["tv:2"]],
  ])(
    "rejects incomplete, duplicated, or foreign references before writing (%j)",
    async (ranked, unranked) => {
      await expect(
        service.layout(owner.toHexString(), board._id.toHexString(), {
          revision: 3,
          tiers: [
            { id: "s", label: "S", color: TierColor.Red, mediaIds: ranked },
          ],
          unrankedMediaIds: unranked,
        }),
      ).rejects.toMatchObject({ code: "INVALID_TIER_LIST" });
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate and reserved tier IDs", async () => {
    for (const tiers of [
      [
        { id: "s", label: "S", color: TierColor.Red, mediaIds: ["tv:1"] },
        { id: "s", label: "A", color: TierColor.Red, mediaIds: ["tv:2"] },
      ],
      [
        {
          id: "__unranked",
          label: "S",
          color: TierColor.Red,
          mediaIds: ["tv:1", "tv:2"],
        },
      ],
    ])
      await expect(
        service.layout(owner.toHexString(), board._id.toHexString(), {
          revision: 3,
          tiers,
          unrankedMediaIds: [],
        }),
      ).rejects.toMatchObject({ code: "INVALID_TIER_LIST" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("rejects stale revisions before work and a write that loses the CAS race", async () => {
    const input = {
      revision: 2,
      title: "New title",
      description: "",
      visibility: TierListVisibility.Private,
    };
    await expect(
      service.update(owner.toHexString(), board._id.toHexString(), input),
    ).rejects.toMatchObject({ code: "TIER_LIST_CONFLICT" });
    expect(repository.save).not.toHaveBeenCalled();
    repository.save.mockResolvedValue(null);
    await expect(
      service.update(owner.toHexString(), board._id.toHexString(), {
        ...input,
        revision: 3,
      }),
    ).rejects.toMatchObject({ code: "TIER_LIST_CONFLICT" });
  });

  it("reuses shared media and ignores duplicate additions", async () => {
    board.unrankedMediaIds = [];
    const result = await service.add(
      owner.toHexString(),
      board._id.toHexString(),
      {
        revision: 3,
        items: [
          { mediaType: MediaType.Tv, tmdbId: 1 },
          { mediaType: MediaType.Tv, tmdbId: 2 },
          { mediaType: MediaType.Tv, tmdbId: 2 },
        ],
      },
    );
    expect(result.unranked.map((item) => item.id)).toEqual(["tv:2"]);
    expect(mediaService.getDetails).not.toHaveBeenCalled();
    expect(mediaRepository.upsertSnapshot).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it("does not partially save a batch when metadata loading fails", async () => {
    mediaService.getDetails.mockRejectedValue(new Error("TMDB offline"));
    await expect(
      service.add(owner.toHexString(), board._id.toHexString(), {
        revision: 3,
        items: [{ mediaType: MediaType.Tv, tmdbId: 9 }],
      }),
    ).rejects.toThrow("TMDB offline");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("enforces the board capacity before resolving new media", async () => {
    board.unrankedMediaIds = Array.from(
      { length: 299 },
      () => new Types.ObjectId(),
    );
    await expect(
      service.add(owner.toHexString(), board._id.toHexString(), {
        revision: 3,
        items: [{ mediaType: MediaType.Tv, tmdbId: 9 }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_TIER_LIST" });
    expect(mediaService.getDetails).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("duplicates a shareable board as a private independent snapshot", async () => {
    board.visibility = TierListVisibility.Public;
    board.publicSlug = "abcdefghijklmnop";
    const result = await service.duplicate(
      owner.toHexString(),
      board._id.toHexString(),
      3,
    );
    expect(result.id).not.toBe(board._id.toHexString());
    expect(result.revision).toBe(0);
    expect(result.visibility).toBe("private");
    expect(result.publicSlug).toBeUndefined();
    expect(result.title).toBe("Favourite dramas (copy)");
    expect(result.itemCount).toBe(2);
  });

  it("keeps a share slug stable until switching back to private", async () => {
    const input = {
      title: board.title,
      description: "",
      revision: 3,
      visibility: TierListVisibility.Public,
    };
    const published = await service.update(
      owner.toHexString(),
      board._id.toHexString(),
      input,
    );
    expect(published.publicSlug).toMatch(/^[\w-]{16}$/);
    const unlisted = await service.update(
      owner.toHexString(),
      board._id.toHexString(),
      { ...input, visibility: TierListVisibility.Unlisted },
    );
    expect(unlisted.publicSlug).toBe(published.publicSlug);
    const hidden = await service.update(
      owner.toHexString(),
      board._id.toHexString(),
      { ...input, visibility: TierListVisibility.Private },
    );
    expect(hidden.publicSlug).toBeUndefined();
    expect(repository.save.mock.lastCall?.[0]).not.toHaveProperty("publicSlug");
  });

  it("exposes ranked titles only, without internal board/tier/media IDs", async () => {
    board.visibility = TierListVisibility.Unlisted;
    board.publicSlug = "abcdefghijklmnop";
    repository.findPublic.mockResolvedValue(board);
    const result = await service.getPublic(board.publicSlug);
    expect(result.itemCount).toBe(1);
    expect(result.tiers[0]?.items[0]?.id).toBe("tv:1");
    expect(result).not.toHaveProperty("unranked");
    expect(result).not.toHaveProperty("revision");
    expect(result).not.toHaveProperty("id");
    expect(result.tiers[0]).not.toHaveProperty("id");
    expect(JSON.stringify(result)).not.toContain(first._id.toHexString());
    expect(JSON.stringify(result)).not.toContain("tv:2");
    expect(mediaRepository.findByIds).toHaveBeenCalledWith([first._id]);
  });

  it("rejects a revoked link and a concurrently changed deletion", async () => {
    repository.findPublic.mockResolvedValue(null);
    await expect(service.getPublic("abcdefghijklmnop")).rejects.toMatchObject({
      code: "TIER_LIST_NOT_FOUND",
    });
    repository.delete.mockResolvedValue(false);
    await expect(
      service.delete(owner.toHexString(), board._id.toHexString(), 3),
    ).rejects.toMatchObject({ code: "TIER_LIST_CONFLICT" });
  });
});

function media(tmdbId: number): StoredMedia {
  return {
    _id: new Types.ObjectId(),
    tmdbId,
    mediaType: MediaType.Tv,
    title: `Drama ${tmdbId}`,
    originalTitle: `Drama ${tmdbId}`,
    originCountry: ["KR"],
    genreIds: [],
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
