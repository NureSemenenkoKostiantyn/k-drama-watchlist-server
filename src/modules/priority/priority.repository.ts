import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import {
  type ClientSession,
  type Connection,
  type HydratedDocument,
  type Model,
  Types,
} from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import {
  type Environment,
  NodeEnvironment,
} from "../../config/environment";
import { USER_MEDIA_MODEL } from "../library/user-media-model.provider";
import { type UserMediaDocument } from "../library/schema/user-media.schema";
import { PRIORITY_LANE_MODEL } from "./priority-lane-model.provider";
import { type PriorityLaneDocument } from "./schema/priority-lane.schema";

export interface StoredPriorityLane {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  position: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriorityLaneSeed {
  name: string;
  position: number;
  isDefault: boolean;
}

export interface PriorityLaneItemOrder {
  laneId: Types.ObjectId;
  itemIds: Types.ObjectId[];
}

@Injectable()
export class PriorityRepository {
  constructor(
    @Inject(PRIORITY_LANE_MODEL)
    private readonly priorityLaneModel: Model<PriorityLaneDocument>,
    @Inject(USER_MEDIA_MODEL)
    private readonly userMediaModel: Model<UserMediaDocument>,
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

  async findAll(userId: Types.ObjectId): Promise<StoredPriorityLane[]> {
    const documents = await this.priorityLaneModel
      .find({ userId })
      .sort({ position: 1 })
      .exec();
    return documents.map(mapPriorityLane);
  }

  async findById(
    userId: Types.ObjectId,
    laneId: Types.ObjectId,
  ): Promise<StoredPriorityLane | null> {
    const document = await this.priorityLaneModel
      .findOne({ _id: laneId, userId })
      .exec();
    return document ? mapPriorityLane(document) : null;
  }

  async createMany(
    userId: Types.ObjectId,
    lanes: PriorityLaneSeed[],
  ): Promise<void> {
    await this.priorityLaneModel.insertMany(
      lanes.map((lane) => ({
        userId,
        ...lane,
      })),
    );
  }

  async create(
    userId: Types.ObjectId,
    name: string,
    position: number,
  ): Promise<StoredPriorityLane> {
    const document = await this.priorityLaneModel.create({
      userId,
      name,
      position,
      isDefault: false,
    });
    return mapPriorityLane(document);
  }

  async updateName(
    userId: Types.ObjectId,
    laneId: Types.ObjectId,
    name: string,
  ): Promise<StoredPriorityLane | null> {
    const document = await this.priorityLaneModel
      .findOneAndUpdate(
        { _id: laneId, userId },
        { $set: { name } },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapPriorityLane(document) : null;
  }

  async delete(
    userId: Types.ObjectId,
    laneId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.priorityLaneModel
      .deleteOne({ _id: laneId, userId })
      .exec();

    if (result.deletedCount !== 1) {
      return false;
    }

    await this.userMediaModel
      .updateMany(
        { userId, priorityLaneId: laneId },
        {
          $unset: {
            priorityLaneId: 1,
            priorityPosition: 1,
          },
        },
      )
      .exec();
    return true;
  }

  async reorderLanes(
    userId: Types.ObjectId,
    laneIds: Types.ObjectId[],
  ): Promise<void> {
    if (laneIds.length === 0) {
      return;
    }

    await this.priorityLaneModel.bulkWrite(
      laneIds.map((laneId, position) => ({
        updateOne: {
          filter: { _id: laneId, userId },
          update: { $set: { position } },
        },
      })),
    );
  }

  async countEligibleItems(
    userId: Types.ObjectId,
    itemIds: Types.ObjectId[],
    session?: ClientSession,
  ): Promise<number> {
    if (itemIds.length === 0) {
      return 0;
    }

    const query = this.userMediaModel.countDocuments({
      _id: { $in: itemIds },
      userId,
      status: WatchStatus.ToWatch,
    });

    if (session) {
      query.session(session);
    }

    return query.exec();
  }

  async countOwnedLanes(
    userId: Types.ObjectId,
    laneIds: Types.ObjectId[],
    session?: ClientSession,
  ): Promise<number> {
    const query = this.priorityLaneModel.countDocuments({
      _id: { $in: laneIds },
      userId,
    });

    if (session) {
      query.session(session);
    }

    return query.exec();
  }

  async replaceLaneItemOrders(
    userId: Types.ObjectId,
    laneOrders: PriorityLaneItemOrder[],
    session?: ClientSession,
  ): Promise<void> {
    const laneIds = laneOrders.map((order) => order.laneId);
    const clearQuery = this.userMediaModel.updateMany(
      { userId, priorityLaneId: { $in: laneIds } },
      {
        $unset: {
          priorityLaneId: 1,
          priorityPosition: 1,
        },
      },
    );

    if (session) {
      clearQuery.session(session);
    }

    await clearQuery.exec();
    const operations = laneOrders.flatMap((order) =>
      order.itemIds.map((itemId, priorityPosition) => ({
        updateOne: {
          filter: {
            _id: itemId,
            userId,
            status: WatchStatus.ToWatch,
          },
          update: {
            $set: {
              priorityLaneId: order.laneId,
              priorityPosition,
            },
          },
        },
      })),
    );

    if (operations.length === 0) {
      return;
    }

    await this.userMediaModel.bulkWrite(
      operations,
      session ? { session } : undefined,
    );
  }
}

function mapPriorityLane(
  document: HydratedDocument<PriorityLaneDocument>,
): StoredPriorityLane {
  return {
    _id: document._id,
    userId: document.userId,
    name: document.name,
    position: document.position,
    isDefault: document.isDefault,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
