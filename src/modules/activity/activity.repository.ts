import { Inject, Injectable } from "@nestjs/common";
import { type HydratedDocument, type Model, Types } from "mongoose";

import { ActivityType } from "../../common/types/activity.types";
import { type WatchStatus } from "../../common/types/library.types";
import { ACTIVITY_EVENT_MODEL } from "./activity-event-model.provider";
import { type ActivityEventDocument } from "./schema/activity-event.schema";

export interface StoredActivityEvent {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId;
  mediaId: Types.ObjectId;
  type: ActivityType;
  status?: WatchStatus;
  rating?: number;
  createdAt: Date;
  deleteAfter: Date;
}

export interface PublishActivityInput {
  actorUserId: Types.ObjectId;
  mediaId: Types.ObjectId;
  type: ActivityType;
  status?: WatchStatus;
  rating?: number;
}

export interface StoredActivityPage {
  items: StoredActivityEvent[];
  totalResults: number;
}

@Injectable()
export class ActivityRepository {
  constructor(
    @Inject(ACTIVITY_EVENT_MODEL)
    private readonly activityModel: Model<ActivityEventDocument>,
  ) {}

  async create(
    input: PublishActivityInput,
    createdAt: Date,
    deleteAfter: Date,
  ): Promise<void> {
    await this.activityModel.create({
      ...input,
      createdAt,
      deleteAfter,
    });
  }

  async findPage(
    actorUserIds: Types.ObjectId[],
    page: number,
    limit: number,
  ): Promise<StoredActivityPage> {
    if (actorUserIds.length === 0) {
      return { items: [], totalResults: 0 };
    }
    const filter = { actorUserId: { $in: actorUserIds } };
    const [documents, totalResults] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.activityModel.countDocuments(filter).exec(),
    ]);
    return {
      items: documents.map(mapActivityEvent),
      totalResults,
    };
  }
}

function mapActivityEvent(
  document: HydratedDocument<ActivityEventDocument>,
): StoredActivityEvent {
  return {
    _id: document._id,
    actorUserId: document.actorUserId,
    mediaId: document.mediaId,
    type: document.type,
    createdAt: document.createdAt,
    deleteAfter: document.deleteAfter,
    ...(document.status === undefined ? {} : { status: document.status }),
    ...(document.rating === undefined ? {} : { rating: document.rating }),
  };
}
