import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import { type PriorityLaneResponse } from "../../common/types/priority.types";
import { type CreatePriorityLaneDto } from "./dto/create-priority-lane.dto";
import { type ReorderPriorityBoardDto } from "./dto/reorder-priority-board.dto";
import { type ReorderPriorityLanesDto } from "./dto/reorder-priority-lanes.dto";
import { type UpdatePriorityLaneDto } from "./dto/update-priority-lane.dto";
import {
  PriorityRepository,
  type StoredPriorityLane,
} from "./priority.repository";

const defaultLanes = [
  "Must watch",
  "I really want to watch",
  "Maybe",
  "If there is nothing else",
] as const;

@Injectable()
export class PriorityService {
  constructor(
    private readonly priorityRepository: PriorityRepository,
  ) {}

  async list(
    authenticatedUserId: string,
  ): Promise<PriorityLaneResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const lanes = await this.findOrCreateDefaultLanes(userId);
    return lanes.map(toPriorityLaneResponse);
  }

  async create(
    authenticatedUserId: string,
    input: CreatePriorityLaneDto,
  ): Promise<PriorityLaneResponse> {
    const userId = toObjectId(authenticatedUserId);
    const lanes = await this.findOrCreateDefaultLanes(userId);
    const lane = await this.priorityRepository.create(
      userId,
      input.name,
      lanes.length,
    );
    return toPriorityLaneResponse(lane);
  }

  async update(
    authenticatedUserId: string,
    laneId: string,
    input: UpdatePriorityLaneDto,
  ): Promise<PriorityLaneResponse> {
    const lane = await this.priorityRepository.updateName(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(laneId),
      input.name,
    );

    if (!lane) {
      throw laneNotFound();
    }

    return toPriorityLaneResponse(lane);
  }

  async delete(
    authenticatedUserId: string,
    laneId: string,
  ): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const deleted = await this.priorityRepository.delete(
      userId,
      new Types.ObjectId(laneId),
    );

    if (!deleted) {
      throw laneNotFound();
    }

    const remaining = await this.priorityRepository.findAll(userId);
    await this.priorityRepository.reorderLanes(
      userId,
      remaining.map((lane) => lane._id),
    );
  }

  async reorderLanes(
    authenticatedUserId: string,
    input: ReorderPriorityLanesDto,
  ): Promise<PriorityLaneResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const lanes = await this.priorityRepository.findAll(userId);

    if (
      input.laneIds.length !== lanes.length ||
      !sameIds(
        input.laneIds,
        lanes.map((lane) => lane._id.toHexString()),
      )
    ) {
      throw invalidPriorityOrder(
        "Lane order must contain every owned lane exactly once.",
      );
    }

    await this.priorityRepository.reorderLanes(
      userId,
      input.laneIds.map((laneId) => new Types.ObjectId(laneId)),
    );
    const reordered = await this.priorityRepository.findAll(userId);
    return reordered.map(toPriorityLaneResponse);
  }

  async reorderItems(
    authenticatedUserId: string,
    input: ReorderPriorityBoardDto,
  ): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const laneIds = input.lanes.map((lane) => lane.laneId);
    const itemIds = input.lanes.flatMap((lane) => lane.itemIds);

    if (new Set(laneIds).size !== laneIds.length) {
      throw invalidPriorityOrder(
        "Each affected priority lane must appear exactly once.",
      );
    }

    if (new Set(itemIds).size !== itemIds.length) {
      throw invalidPriorityOrder(
        "A priority entry cannot appear in more than one lane.",
      );
    }

    const laneOrders = input.lanes.map((lane) => ({
      laneId: new Types.ObjectId(lane.laneId),
      itemIds: lane.itemIds.map(
        (itemId) => new Types.ObjectId(itemId),
      ),
    }));

    await this.priorityRepository.runInTransaction(async (session) => {
      const ownedLaneCount =
        await this.priorityRepository.countOwnedLanes(
          userId,
          laneOrders.map((order) => order.laneId),
          session,
        );

      if (ownedLaneCount !== laneOrders.length) {
        throw laneNotFound();
      }

      const eligibleCount =
        await this.priorityRepository.countEligibleItems(
          userId,
          laneOrders.flatMap((order) => order.itemIds),
          session,
        );

      if (eligibleCount !== itemIds.length) {
        throw invalidPriorityOrder(
          "Priority lanes accept only owned to-watch entries.",
        );
      }

      await this.priorityRepository.replaceLaneItemOrders(
        userId,
        laneOrders,
        session,
      );
    });
  }

  private async findOrCreateDefaultLanes(
    userId: Types.ObjectId,
  ): Promise<StoredPriorityLane[]> {
    let lanes = await this.priorityRepository.findAll(userId);

    if (lanes.length === 0) {
      await this.priorityRepository.createMany(
        userId,
        defaultLanes.map((name, position) => ({
          name,
          position,
          isDefault: true,
        })),
      );
      lanes = await this.priorityRepository.findAll(userId);
    }

    return lanes;
  }
}

function toPriorityLaneResponse(
  lane: StoredPriorityLane,
): PriorityLaneResponse {
  return {
    id: lane._id.toHexString(),
    name: lane.name,
    position: lane.position,
    isDefault: lane.isDefault,
    createdAt: lane.createdAt.toISOString(),
    updatedAt: lane.updatedAt.toISOString(),
  };
}

function sameIds(left: string[], right: string[]): boolean {
  const expected = new Set(right);
  return (
    new Set(left).size === left.length &&
    left.every((id) => expected.has(id))
  );
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function laneNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Priority lane not found.",
  });
}

function invalidPriorityOrder(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message,
  });
}
