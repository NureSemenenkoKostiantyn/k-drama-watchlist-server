import { HttpStatus, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  type SelectedWheelItemResponse,
  type WheelDetailsResponse,
  type WheelItemResponse,
  type WheelResponse,
  WheelSelectionMode,
  type WheelSpinHistoryResponse,
  type WheelSpinResponse,
} from "../../common/types/wheel.types";
import {
  MediaRepository,
  type StoredMedia,
  toMediaDetails,
} from "../media/media.repository";
import { type AddWheelItemDto } from "./dto/add-wheel-item.dto";
import { type CreateWheelDto } from "./dto/create-wheel.dto";
import { type ReorderWheelItemsDto } from "./dto/reorder-wheel-items.dto";
import { type UpdateWheelItemDto } from "./dto/update-wheel-item.dto";
import { type UpdateWheelDto } from "./dto/update-wheel.dto";
import {
  type StoredWheel,
  type StoredWheelItem,
  type StoredWheelSpin,
  WheelsRepository,
} from "./wheels.repository";

@Injectable()
export class WheelsService {
  constructor(
    private readonly wheelsRepository: WheelsRepository,
    private readonly mediaRepository: MediaRepository,
  ) {}

  async list(authenticatedUserId: string): Promise<WheelResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const wheels = await this.wheelsRepository.findAll(userId);
    const items = await this.wheelsRepository.findItemsForWheels(
      wheels.map((wheel) => wheel._id),
    );
    const itemsByWheelId = groupItemsByWheel(items);
    return wheels.map((wheel) =>
      toWheelResponse(
        wheel,
        itemsByWheelId.get(wheel._id.toHexString()) ?? [],
      ),
    );
  }

  async create(
    authenticatedUserId: string,
    input: CreateWheelDto,
  ): Promise<WheelDetailsResponse> {
    const wheel = await this.wheelsRepository.create(
      toObjectId(authenticatedUserId),
      input.title,
      normalizeOptionalText(input.description),
      input.selectionMode ?? WheelSelectionMode.FullyRandom,
    );
    return toWheelDetailsResponse(wheel, []);
  }

  async get(
    authenticatedUserId: string,
    wheelId: string,
  ): Promise<WheelDetailsResponse> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    const wheel = await this.requireWheel(userId, wheelIdObject);
    return this.withItems(wheel);
  }

  async update(
    authenticatedUserId: string,
    wheelId: string,
    input: UpdateWheelDto,
  ): Promise<WheelDetailsResponse> {
    if (
      input.title === undefined &&
      input.description === undefined &&
      input.selectionMode === undefined
    ) {
      throw invalidWheel("Provide a wheel field to update.");
    }

    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    const wheel = await this.wheelsRepository.update(
      userId,
      wheelIdObject,
      {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined
          ? {}
          : {
              description:
                input.description === null
                  ? null
                  : (normalizeOptionalText(input.description) ?? null),
            }),
        ...(input.selectionMode === undefined
          ? {}
          : { selectionMode: input.selectionMode }),
      },
    );

    if (!wheel) {
      throw wheelNotFound();
    }

    return this.withItems(wheel);
  }

  async delete(
    authenticatedUserId: string,
    wheelId: string,
  ): Promise<void> {
    const deleted = await this.wheelsRepository.delete(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(wheelId),
    );

    if (!deleted) {
      throw wheelNotFound();
    }
  }

  async addItem(
    authenticatedUserId: string,
    wheelId: string,
    input: AddWheelItemDto,
  ): Promise<WheelItemResponse> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    await this.requireWheel(userId, wheelIdObject);
    const mediaId = new Types.ObjectId(input.mediaId);
    const media = await this.mediaRepository.findById(mediaId);

    if (!media) {
      throw mediaNotFound();
    }

    const items = await this.wheelsRepository.findItems(wheelIdObject);

    try {
      const item = await this.wheelsRepository.createItem(
        wheelIdObject,
        mediaId,
        userId,
        items.length,
        input.weight ?? 1,
      );
      await this.wheelsRepository.touch(wheelIdObject);
      return toWheelItemResponse(item, media);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw wheelItemAlreadyExists();
      }

      throw error;
    }
  }

  async updateItem(
    authenticatedUserId: string,
    wheelId: string,
    itemId: string,
    input: UpdateWheelItemDto,
  ): Promise<WheelItemResponse> {
    if (input.weight === undefined && input.isEnabled === undefined) {
      throw invalidWheel("Provide a wheel item field to update.");
    }

    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    await this.requireWheel(userId, wheelIdObject);
    const item = await this.wheelsRepository.updateItem(
      wheelIdObject,
      new Types.ObjectId(itemId),
      input,
    );

    if (!item) {
      throw wheelItemNotFound();
    }

    const media = await this.requireMedia(item.mediaId);
    await this.wheelsRepository.touch(wheelIdObject);
    return toWheelItemResponse(item, media);
  }

  async deleteItem(
    authenticatedUserId: string,
    wheelId: string,
    itemId: string,
  ): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    await this.requireWheel(userId, wheelIdObject);
    const deleted = await this.wheelsRepository.deleteItem(
      wheelIdObject,
      new Types.ObjectId(itemId),
    );

    if (!deleted) {
      throw wheelItemNotFound();
    }

    const remaining = await this.wheelsRepository.findItems(wheelIdObject);
    await this.wheelsRepository.reorderItems(
      wheelIdObject,
      remaining.map((item) => item._id),
    );
    await this.wheelsRepository.touch(wheelIdObject);
  }

  async reorderItems(
    authenticatedUserId: string,
    wheelId: string,
    input: ReorderWheelItemsDto,
  ): Promise<WheelItemResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    await this.requireWheel(userId, wheelIdObject);
    const currentItems = await this.wheelsRepository.findItems(
      wheelIdObject,
    );

    if (
      input.itemIds.length !== currentItems.length ||
      !sameIds(
        input.itemIds,
        currentItems.map((item) => item._id.toHexString()),
      )
    ) {
      throw invalidWheel(
        "Item order must contain every wheel item exactly once.",
      );
    }

    await this.wheelsRepository.reorderItems(
      wheelIdObject,
      input.itemIds.map((itemId) => new Types.ObjectId(itemId)),
    );
    await this.wheelsRepository.touch(wheelIdObject);
    const items = await this.wheelsRepository.findItems(wheelIdObject);
    return this.withMedia(items);
  }

  async spin(
    authenticatedUserId: string,
    wheelId: string,
  ): Promise<WheelSpinResponse> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    const wheel = await this.requireWheel(userId, wheelIdObject);
    const items = await this.wheelsRepository.findItems(wheelIdObject);
    const selectedItem = selectWheelItem(items, wheel.selectionMode);
    const selectedAt = new Date();
    const spin = await this.wheelsRepository.runInTransaction((session) =>
      this.wheelsRepository.recordSpin(
        wheelIdObject,
        selectedItem._id,
        userId,
        selectedAt,
        session,
      ),
    );

    if (!spin) {
      throw noEnabledWheelItems();
    }

    const media = await this.requireMedia(selectedItem.mediaId);
    return {
      spinId: spin._id.toHexString(),
      selectedItem: toSelectedItemResponse(selectedItem, media),
    };
  }

  async history(
    authenticatedUserId: string,
    wheelId: string,
  ): Promise<WheelSpinHistoryResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    await this.requireWheel(userId, wheelIdObject);
    const [spins, items] = await Promise.all([
      this.wheelsRepository.findSpins(wheelIdObject),
      this.wheelsRepository.findItems(wheelIdObject),
    ]);
    return this.toHistory(spins, items);
  }

  async resetHistory(
    authenticatedUserId: string,
    wheelId: string,
  ): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const wheelIdObject = new Types.ObjectId(wheelId);
    await this.requireWheel(userId, wheelIdObject);
    await this.wheelsRepository.runInTransaction((session) =>
      this.wheelsRepository.resetHistory(wheelIdObject, session),
    );
  }

  private async requireWheel(
    userId: Types.ObjectId,
    wheelId: Types.ObjectId,
  ): Promise<StoredWheel> {
    const wheel = await this.wheelsRepository.findById(userId, wheelId);

    if (!wheel) {
      throw wheelNotFound();
    }

    return wheel;
  }

  private async requireMedia(mediaId: Types.ObjectId): Promise<StoredMedia> {
    const media = await this.mediaRepository.findById(mediaId);

    if (!media) {
      throw mediaNotFound();
    }

    return media;
  }

  private async withItems(
    wheel: StoredWheel,
  ): Promise<WheelDetailsResponse> {
    const items = await this.wheelsRepository.findItems(wheel._id);
    return {
      ...toWheelResponse(wheel, items),
      items: await this.withMedia(items),
    };
  }

  private async withMedia(
    items: StoredWheelItem[],
  ): Promise<WheelItemResponse[]> {
    const media = await this.mediaRepository.findByIds(
      items.map((item) => item.mediaId),
    );
    const mediaById = new Map(
      media.map((entry) => [entry._id.toHexString(), entry]),
    );
    return items.map((item) => {
      const itemMedia = mediaById.get(item.mediaId.toHexString());

      if (!itemMedia) {
        throw mediaNotFound();
      }

      return toWheelItemResponse(item, itemMedia);
    });
  }

  private async toHistory(
    spins: StoredWheelSpin[],
    items: StoredWheelItem[],
  ): Promise<WheelSpinHistoryResponse[]> {
    const itemById = new Map(
      items.map((item) => [item._id.toHexString(), item]),
    );
    const media = await this.mediaRepository.findByIds(
      items.map((item) => item.mediaId),
    );
    const mediaById = new Map(
      media.map((entry) => [entry._id.toHexString(), entry]),
    );

    return spins.map((spin) => {
      const item = itemById.get(spin.selectedItemId.toHexString());
      const itemMedia =
        item === undefined
          ? undefined
          : mediaById.get(item.mediaId.toHexString());

      if (!item || !itemMedia) {
        throw new Error(
          `Wheel spin ${spin._id.toHexString()} references missing data.`,
        );
      }

      return {
        spinId: spin._id.toHexString(),
        selectedItem: toSelectedItemResponse(item, itemMedia),
        createdAt: spin.createdAt.toISOString(),
      };
    });
  }
}

export function selectWheelItem(
  items: StoredWheelItem[],
  selectionMode: WheelSelectionMode,
  random: () => number = Math.random,
): StoredWheelItem {
  const enabledItems = items.filter((item) => item.isEnabled);

  if (enabledItems.length === 0) {
    throw noEnabledWheelItems();
  }

  const candidates =
    selectionMode === WheelSelectionMode.AvoidRecentWinners &&
    enabledItems.length > 1
      ? excludeMostRecentWinner(enabledItems)
      : enabledItems;
  const totalWeight = candidates.reduce(
    (total, item) => total + item.weight,
    0,
  );
  const target = random() * totalWeight;
  let cumulativeWeight = 0;

  for (const item of candidates) {
    cumulativeWeight += item.weight;

    if (target < cumulativeWeight) {
      return item;
    }
  }

  const fallback = candidates[candidates.length - 1];

  if (!fallback) {
    throw noEnabledWheelItems();
  }

  return fallback;
}

function excludeMostRecentWinner(
  items: StoredWheelItem[],
): StoredWheelItem[] {
  const mostRecentWinner = items
    .filter((item) => item.lastSelectedAt !== undefined)
    .sort(
      (left, right) =>
        (right.lastSelectedAt?.getTime() ?? 0) -
        (left.lastSelectedAt?.getTime() ?? 0),
    )[0];
  return mostRecentWinner
    ? items.filter((item) => !item._id.equals(mostRecentWinner._id))
    : items;
}

function groupItemsByWheel(
  items: StoredWheelItem[],
): Map<string, StoredWheelItem[]> {
  const grouped = new Map<string, StoredWheelItem[]>();

  for (const item of items) {
    const wheelId = item.wheelId.toHexString();
    grouped.set(wheelId, [...(grouped.get(wheelId) ?? []), item]);
  }

  return grouped;
}

function toWheelResponse(
  wheel: StoredWheel,
  items: StoredWheelItem[],
): WheelResponse {
  return {
    id: wheel._id.toHexString(),
    title: wheel.title,
    visibility: wheel.visibility,
    selectionMode: wheel.selectionMode,
    itemCount: items.length,
    enabledItemCount: items.filter((item) => item.isEnabled).length,
    createdAt: wheel.createdAt.toISOString(),
    updatedAt: wheel.updatedAt.toISOString(),
    ...(wheel.description === undefined
      ? {}
      : { description: wheel.description }),
  };
}

function toWheelDetailsResponse(
  wheel: StoredWheel,
  items: WheelItemResponse[],
): WheelDetailsResponse {
  return {
    ...toWheelResponse(wheel, []),
    itemCount: items.length,
    enabledItemCount: items.filter((item) => item.isEnabled).length,
    items,
  };
}

function toWheelItemResponse(
  item: StoredWheelItem,
  media: StoredMedia,
): WheelItemResponse {
  return {
    id: item._id.toHexString(),
    mediaId: item.mediaId.toHexString(),
    position: item.position,
    weight: item.weight,
    isEnabled: item.isEnabled,
    selectionCount: item.selectionCount,
    media: toMediaDetails(media),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    ...(item.lastSelectedAt === undefined
      ? {}
      : { lastSelectedAt: item.lastSelectedAt.toISOString() }),
  };
}

function toSelectedItemResponse(
  item: StoredWheelItem,
  media: StoredMedia,
): SelectedWheelItemResponse {
  return {
    wheelItemId: item._id.toHexString(),
    mediaId: item.mediaId.toHexString(),
    title: media.title,
    ...(media.posterUrl === undefined
      ? {}
      : { posterUrl: media.posterUrl }),
  };
}

function sameIds(left: string[], right: string[]): boolean {
  const expected = new Set(right);
  return (
    new Set(left).size === left.length &&
    left.every((id) => expected.has(id))
  );
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function wheelNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Wheel not found.",
  });
}

function wheelItemNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Wheel item not found.",
  });
}

function mediaNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Media not found.",
  });
}

function wheelItemAlreadyExists(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "WHEEL_ITEM_ALREADY_EXISTS",
    message: "This title is already on the wheel.",
  });
}

function noEnabledWheelItems(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "WHEEL_HAS_NO_ENABLED_ITEMS",
    message: "Enable at least one wheel item before spinning.",
  });
}

function invalidWheel(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message,
  });
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
