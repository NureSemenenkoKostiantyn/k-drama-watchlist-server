import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  type PriorityRepository,
  type StoredPriorityLane,
} from "./priority.repository";
import { PriorityService } from "./priority.service";

describe("PriorityService", () => {
  const findAll = jest.fn<PriorityRepository["findAll"]>();
  const findById = jest.fn<PriorityRepository["findById"]>();
  const createMany = jest.fn<PriorityRepository["createMany"]>();
  const create = jest.fn<PriorityRepository["create"]>();
  const updateName = jest.fn<PriorityRepository["updateName"]>();
  const deleteLane = jest.fn<PriorityRepository["delete"]>();
  const reorderLanes =
    jest.fn<PriorityRepository["reorderLanes"]>();
  const runInTransaction = jest
    .fn<PriorityRepository["runInTransaction"]>()
    .mockImplementation((work) => work());
  const countOwnedLanes =
    jest.fn<PriorityRepository["countOwnedLanes"]>();
  const countEligibleItems =
    jest.fn<PriorityRepository["countEligibleItems"]>();
  const replaceLaneItemOrders =
    jest.fn<PriorityRepository["replaceLaneItemOrders"]>();
  const service = new PriorityService({
    findAll,
    findById,
    createMany,
    create,
    updateName,
    delete: deleteLane,
    reorderLanes,
    runInTransaction,
    countOwnedLanes,
    countEligibleItems,
    replaceLaneItemOrders,
  } as unknown as PriorityRepository);
  const userId = new Types.ObjectId();
  const laneId = new Types.ObjectId();
  const now = new Date("2026-07-24T10:00:00.000Z");
  const lane: StoredPriorityLane = {
    _id: laneId,
    userId,
    name: "Must watch",
    position: 0,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("provisions the four default lanes on first access", async () => {
    findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        lane,
        {
          ...lane,
          _id: new Types.ObjectId(),
          name: "I really want to watch",
          position: 1,
        },
        {
          ...lane,
          _id: new Types.ObjectId(),
          name: "Maybe",
          position: 2,
        },
        {
          ...lane,
          _id: new Types.ObjectId(),
          name: "If there is nothing else",
          position: 3,
        },
      ]);
    createMany.mockResolvedValue();

    await expect(
      service.list(userId.toHexString()),
    ).resolves.toHaveLength(4);
    expect(createMany).toHaveBeenCalledWith(userId, [
      { name: "Must watch", position: 0, isDefault: true },
      {
        name: "I really want to watch",
        position: 1,
        isDefault: true,
      },
      { name: "Maybe", position: 2, isDefault: true },
      {
        name: "If there is nothing else",
        position: 3,
        isDefault: true,
      },
    ]);
  });

  it("requires lane reordering to include every owned lane", async () => {
    findAll.mockResolvedValue([
      lane,
      {
        ...lane,
        _id: new Types.ObjectId(),
        position: 1,
      },
    ]);

    await expect(
      service.reorderLanes(userId.toHexString(), {
        laneIds: [laneId.toHexString()],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(reorderLanes).not.toHaveBeenCalled();
  });

  it("assigns only owned to-watch entries to a lane", async () => {
    const entryId = new Types.ObjectId();
    countOwnedLanes.mockResolvedValue(1);
    countEligibleItems.mockResolvedValue(1);
    replaceLaneItemOrders.mockResolvedValue();

    await service.reorderItems(
      userId.toHexString(),
      {
        lanes: [
          {
            laneId: laneId.toHexString(),
            itemIds: [entryId.toHexString()],
          },
        ],
      },
    );

    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(replaceLaneItemOrders).toHaveBeenCalledWith(
      userId,
      [{ laneId, itemIds: [entryId] }],
      undefined,
    );
  });

  it("rejects entries that are not eligible for priority", async () => {
    const entryId = new Types.ObjectId();
    countOwnedLanes.mockResolvedValue(1);
    countEligibleItems.mockResolvedValue(0);

    await expect(
      service.reorderItems(
        userId.toHexString(),
        {
          lanes: [
            {
              laneId: laneId.toHexString(),
              itemIds: [entryId.toHexString()],
            },
          ],
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(replaceLaneItemOrders).not.toHaveBeenCalled();
  });

  it("rejects an entry duplicated across affected lanes", async () => {
    const entryId = new Types.ObjectId().toHexString();

    await expect(
      service.reorderItems(userId.toHexString(), {
        lanes: [
          {
            laneId: laneId.toHexString(),
            itemIds: [entryId],
          },
          {
            laneId: new Types.ObjectId().toHexString(),
            itemIds: [entryId],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(runInTransaction).not.toHaveBeenCalled();
  });
});
