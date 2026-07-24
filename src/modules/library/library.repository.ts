import { Inject, Injectable } from "@nestjs/common";
import {
  type HydratedDocument,
  type Model,
  Types,
} from "mongoose";

import { WatchStatus } from "../../common/types/library.types";
import { USER_MEDIA_MODEL } from "./user-media-model.provider";
import { type UserMediaDocument } from "./schema/user-media.schema";

export interface StoredUserMedia {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  mediaId: Types.ObjectId;
  status: WatchStatus;
  rating?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class LibraryRepository {
  constructor(
    @Inject(USER_MEDIA_MODEL)
    private readonly userMediaModel: Model<UserMediaDocument>,
  ) {}

  async findAll(
    userId: Types.ObjectId,
    status?: WatchStatus,
  ): Promise<StoredUserMedia[]> {
    const filter: {
      userId: Types.ObjectId;
      status?: WatchStatus;
    } = {
      userId,
      ...(status === undefined ? {} : { status }),
    };
    const documents = await this.userMediaModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .exec();
    return documents.map(mapUserMediaDocument);
  }

  async findById(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
  ): Promise<StoredUserMedia | null> {
    const document = await this.userMediaModel
      .findOne({ _id: entryId, userId })
      .exec();
    return document ? mapUserMediaDocument(document) : null;
  }

  async findByMedia(
    userId: Types.ObjectId,
    mediaId: Types.ObjectId,
  ): Promise<StoredUserMedia | null> {
    const document = await this.userMediaModel
      .findOne({ userId, mediaId })
      .exec();
    return document ? mapUserMediaDocument(document) : null;
  }

  async create(
    userId: Types.ObjectId,
    mediaId: Types.ObjectId,
    status: WatchStatus,
  ): Promise<StoredUserMedia> {
    const document = await this.userMediaModel.create({
      userId,
      mediaId,
      status,
      categoryIds: [],
    });
    return mapUserMediaDocument(document);
  }

  async updateStatus(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
    status: WatchStatus,
  ): Promise<StoredUserMedia | null> {
    const document = await this.userMediaModel
      .findOneAndUpdate(
        { _id: entryId, userId },
        {
          $set: { status },
          ...(status === WatchStatus.ToWatch
            ? {}
            : {
                $unset: {
                  priorityLaneId: 1,
                  priorityPosition: 1,
                },
              }),
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapUserMediaDocument(document) : null;
  }

  async delete(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.userMediaModel
      .deleteOne({ _id: entryId, userId })
      .exec();
    return result.deletedCount === 1;
  }
}

function mapUserMediaDocument(
  document: HydratedDocument<UserMediaDocument>,
): StoredUserMedia {
  return {
    _id: document._id,
    userId: document.userId,
    mediaId: document.mediaId,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.rating === undefined ? {} : { rating: document.rating }),
    ...(document.description === undefined
      ? {}
      : { description: document.description }),
  };
}
