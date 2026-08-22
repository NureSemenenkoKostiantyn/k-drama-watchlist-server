import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import {
  type ClientSession,
  type Connection,
  type HydratedDocument,
  type Model,
  Types,
  type UpdateQuery,
} from "mongoose";

import {
  WheelRole,
  WheelSelectionMode,
  WheelVisibility,
} from "../../common/types/wheel.types";
import {
  type Environment,
  NodeEnvironment,
} from "../../config/environment";
import { type WheelItemDocument } from "./schema/wheel-item.schema";
import { type WheelSpinDocument } from "./schema/wheel-spin.schema";
import {
  type WheelDocument,
  type WheelMemberDocument,
} from "./schema/wheel.schema";
import {
  WHEEL_ITEM_MODEL,
  WHEEL_MODEL,
  WHEEL_SPIN_MODEL,
} from "./wheel-model.providers";

export interface StoredWheel {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  visibility: WheelVisibility;
  publicSlug?: string;
  selectionMode: WheelSelectionMode;
  members: WheelMemberDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredWheelItem {
  _id: Types.ObjectId;
  wheelId: Types.ObjectId;
  mediaId: Types.ObjectId;
  addedByUserId: Types.ObjectId;
  position: number;
  weight: number;
  isEnabled: boolean;
  lastSelectedAt?: Date;
  selectionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredWheelSpin {
  _id: Types.ObjectId;
  wheelId: Types.ObjectId;
  selectedItemId: Types.ObjectId;
  spunByUserId: Types.ObjectId;
  createdAt: Date;
}

export interface WheelUpdate {
  title?: string;
  description?: string | null;
  selectionMode?: WheelSelectionMode;
}

export interface WheelItemUpdate {
  weight?: number;
  isEnabled?: boolean;
}

@Injectable()
export class WheelsRepository {
  constructor(
    @Inject(WHEEL_MODEL)
    private readonly wheelModel: Model<WheelDocument>,
    @Inject(WHEEL_ITEM_MODEL)
    private readonly wheelItemModel: Model<WheelItemDocument>,
    @Inject(WHEEL_SPIN_MODEL)
    private readonly wheelSpinModel: Model<WheelSpinDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async runInTransaction<T>(
    work: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    if (
      this.configService.getOrThrow<NodeEnvironment>("NODE_ENV") !==
      NodeEnvironment.Production
    ) {
      return work();
    }

    return this.connection.transaction((session) => work(session));
  }

  async findAll(userId: Types.ObjectId): Promise<StoredWheel[]> {
    const documents = await this.wheelModel
      .find({
        $or: [{ ownerId: userId }, { "members.userId": userId }],
      })
      .sort({ updatedAt: -1 })
      .exec();
    return documents.map(mapWheel);
  }

  async findById(
    userId: Types.ObjectId,
    wheelId: Types.ObjectId,
  ): Promise<StoredWheel | null> {
    const document = await this.wheelModel
      .findOne({
        _id: wheelId,
        $or: [{ ownerId: userId }, { "members.userId": userId }],
      })
      .exec();
    return document ? mapWheel(document) : null;
  }

  async create(
    ownerId: Types.ObjectId,
    title: string,
    description: string | undefined,
    selectionMode: WheelSelectionMode,
  ): Promise<StoredWheel> {
    const document = await this.wheelModel.create({
      ownerId,
      title,
      ...(description === undefined ? {} : { description }),
      visibility: WheelVisibility.Private,
      selectionMode,
      members: [{ userId: ownerId, role: WheelRole.Owner }],
    });
    return mapWheel(document);
  }

  async update(
    ownerId: Types.ObjectId,
    wheelId: Types.ObjectId,
    input: WheelUpdate,
  ): Promise<StoredWheel | null> {
    const setValues: Record<string, unknown> = {};
    const unsetValues: Record<string, 1> = {};

    if (input.title !== undefined) {
      setValues.title = input.title;
    }

    if (input.selectionMode !== undefined) {
      setValues.selectionMode = input.selectionMode;
    }

    if (input.description === null) {
      unsetValues.description = 1;
    } else if (input.description !== undefined) {
      setValues.description = input.description;
    }

    const update: UpdateQuery<WheelDocument> = {
      ...(Object.keys(setValues).length === 0
        ? {}
        : { $set: setValues }),
      ...(Object.keys(unsetValues).length === 0
        ? {}
        : { $unset: unsetValues }),
    };
    const document = await this.wheelModel
      .findOneAndUpdate(
        {
          _id: wheelId,
          ownerId,
        },
        update,
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapWheel(document) : null;
  }

  async delete(
    ownerId: Types.ObjectId,
    wheelId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.wheelModel
      .deleteOne({
        _id: wheelId,
        ownerId,
      })
      .exec();

    if (result.deletedCount !== 1) {
      return false;
    }

    await Promise.all([
      this.wheelItemModel.deleteMany({ wheelId }).exec(),
      this.wheelSpinModel.deleteMany({ wheelId }).exec(),
    ]);
    return true;
  }

  async addMember(
    ownerId: Types.ObjectId,
    wheelId: Types.ObjectId,
    memberUserId: Types.ObjectId,
    role: WheelRole.Editor | WheelRole.Viewer,
  ): Promise<StoredWheel | null> {
    const document = await this.wheelModel
      .findOneAndUpdate(
        {
          _id: wheelId,
          ownerId,
          "members.userId": { $ne: memberUserId },
        },
        {
          $push: {
            members: { userId: memberUserId, role },
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapWheel(document) : null;
  }

  async updateMember(
    ownerId: Types.ObjectId,
    wheelId: Types.ObjectId,
    memberUserId: Types.ObjectId,
    role: WheelRole.Editor | WheelRole.Viewer,
  ): Promise<StoredWheel | null> {
    const document = await this.wheelModel
      .findOneAndUpdate(
        {
          _id: wheelId,
          ownerId,
          members: {
            $elemMatch: {
              userId: memberUserId,
              role: { $ne: WheelRole.Owner },
            },
          },
        },
        {
          $set: { "members.$.role": role },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapWheel(document) : null;
  }

  async removeMember(
    ownerId: Types.ObjectId,
    wheelId: Types.ObjectId,
    memberUserId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.wheelModel
      .updateOne(
        { _id: wheelId, ownerId },
        {
          $pull: {
            members: {
              userId: memberUserId,
              role: { $ne: WheelRole.Owner },
            },
          },
        },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async findItems(wheelId: Types.ObjectId): Promise<StoredWheelItem[]> {
    const documents = await this.wheelItemModel
      .find({ wheelId })
      .sort({ position: 1 })
      .exec();
    return documents.map(mapWheelItem);
  }

  async findItemsForWheels(
    wheelIds: Types.ObjectId[],
  ): Promise<StoredWheelItem[]> {
    if (wheelIds.length === 0) {
      return [];
    }

    const documents = await this.wheelItemModel
      .find({ wheelId: { $in: wheelIds } })
      .sort({ position: 1 })
      .exec();
    return documents.map(mapWheelItem);
  }

  async touch(wheelId: Types.ObjectId): Promise<void> {
    await this.wheelModel
      .updateOne({ _id: wheelId }, { $set: { updatedAt: new Date() } })
      .exec();
  }

  async findItemById(
    wheelId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<StoredWheelItem | null> {
    const document = await this.wheelItemModel
      .findOne({ _id: itemId, wheelId })
      .exec();
    return document ? mapWheelItem(document) : null;
  }

  async createItem(
    wheelId: Types.ObjectId,
    mediaId: Types.ObjectId,
    addedByUserId: Types.ObjectId,
    position: number,
    weight: number,
  ): Promise<StoredWheelItem> {
    const document = await this.wheelItemModel.create({
      wheelId,
      mediaId,
      addedByUserId,
      position,
      weight,
      isEnabled: true,
      selectionCount: 0,
    });
    return mapWheelItem(document);
  }

  async updateItem(
    wheelId: Types.ObjectId,
    itemId: Types.ObjectId,
    input: WheelItemUpdate,
  ): Promise<StoredWheelItem | null> {
    const document = await this.wheelItemModel
      .findOneAndUpdate(
        { _id: itemId, wheelId },
        { $set: input },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapWheelItem(document) : null;
  }

  async deleteItem(
    wheelId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.wheelItemModel
      .deleteOne({ _id: itemId, wheelId })
      .exec();

    if (result.deletedCount !== 1) {
      return false;
    }

    await this.wheelSpinModel
      .deleteMany({ wheelId, selectedItemId: itemId })
      .exec();
    return true;
  }

  async reorderItems(
    wheelId: Types.ObjectId,
    itemIds: Types.ObjectId[],
  ): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    await this.wheelItemModel.bulkWrite(
      itemIds.map((itemId, position) => ({
        updateOne: {
          filter: { _id: itemId, wheelId },
          update: { $set: { position } },
        },
      })),
    );
  }

  async recordSpin(
    wheelId: Types.ObjectId,
    itemId: Types.ObjectId,
    spunByUserId: Types.ObjectId,
    selectedAt: Date,
    session?: ClientSession,
  ): Promise<StoredWheelSpin | null> {
    const itemQuery = this.wheelItemModel.findOneAndUpdate(
      { _id: itemId, wheelId, isEnabled: true },
      {
        $inc: { selectionCount: 1 },
        $set: { lastSelectedAt: selectedAt },
      },
      { returnDocument: "after" },
    );

    if (session) {
      itemQuery.session(session);
    }

    const item = await itemQuery.exec();

    if (!item) {
      return null;
    }

    const documents = await this.wheelSpinModel.create(
      [
        {
          wheelId,
          selectedItemId: itemId,
          spunByUserId,
          createdAt: selectedAt,
        },
      ],
      session ? { session } : undefined,
    );
    const spin = documents[0];

    if (!spin) {
      throw new Error("Wheel spin was not persisted.");
    }

    return mapWheelSpin(spin);
  }

  async findSpins(wheelId: Types.ObjectId): Promise<StoredWheelSpin[]> {
    const documents = await this.wheelSpinModel
      .find({ wheelId })
      .sort({ createdAt: -1 })
      .exec();
    return documents.map(mapWheelSpin);
  }

  async resetHistory(
    wheelId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    const deleteQuery = this.wheelSpinModel.deleteMany({ wheelId });
    const updateQuery = this.wheelItemModel.updateMany(
      { wheelId },
      {
        $set: { selectionCount: 0 },
        $unset: { lastSelectedAt: 1 },
      },
    );

    if (session) {
      deleteQuery.session(session);
      updateQuery.session(session);
    }

    await Promise.all([deleteQuery.exec(), updateQuery.exec()]);
  }
}

function mapWheel(
  document: HydratedDocument<WheelDocument>,
): StoredWheel {
  return {
    _id: document._id,
    ownerId: document.ownerId,
    title: document.title,
    visibility: document.visibility,
    selectionMode: document.selectionMode,
    members: document.members.map((member) => ({
      userId: member.userId,
      role: member.role,
    })),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.description === undefined
      ? {}
      : { description: document.description }),
    ...(document.publicSlug === undefined
      ? {}
      : { publicSlug: document.publicSlug }),
  };
}

function mapWheelItem(
  document: HydratedDocument<WheelItemDocument>,
): StoredWheelItem {
  return {
    _id: document._id,
    wheelId: document.wheelId,
    mediaId: document.mediaId,
    addedByUserId: document.addedByUserId,
    position: document.position,
    weight: document.weight,
    isEnabled: document.isEnabled,
    selectionCount: document.selectionCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.lastSelectedAt === undefined
      ? {}
      : { lastSelectedAt: document.lastSelectedAt }),
  };
}

function mapWheelSpin(
  document: HydratedDocument<WheelSpinDocument>,
): StoredWheelSpin {
  return {
    _id: document._id,
    wheelId: document.wheelId,
    selectedItemId: document.selectedItemId,
    spunByUserId: document.spunByUserId,
    createdAt: document.createdAt,
  };
}
