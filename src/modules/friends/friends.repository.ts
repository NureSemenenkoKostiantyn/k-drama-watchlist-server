import { Inject, Injectable } from "@nestjs/common";
import {
  type HydratedDocument,
  type Model,
  Types,
} from "mongoose";

import { type FriendshipStatus } from "../../common/types/friendship.types";
import { FRIENDSHIP_MODEL } from "./friendship-model.provider";
import { type FriendshipDocument } from "./schema/friendship.schema";

export interface StoredFriendship {
  _id: Types.ObjectId;
  requesterId: Types.ObjectId;
  recipientId: Types.ObjectId;
  pairKey: string;
  status: FriendshipStatus;
  createdAt: Date;
  acceptedAt?: Date;
}

@Injectable()
export class FriendsRepository {
  constructor(
    @Inject(FRIENDSHIP_MODEL)
    private readonly friendshipModel: Model<FriendshipDocument>,
  ) {}

  async findAllForUser(
    userId: Types.ObjectId,
  ): Promise<StoredFriendship[]> {
    const documents = await this.friendshipModel
      .find({
        $or: [{ requesterId: userId }, { recipientId: userId }],
      })
      .sort({ createdAt: -1 })
      .exec();
    return documents.map(mapFriendshipDocument);
  }

  async create(
    requesterId: Types.ObjectId,
    recipientId: Types.ObjectId,
    pairKey: string,
  ): Promise<StoredFriendship> {
    const document = await this.friendshipModel.create({
      requesterId,
      recipientId,
      pairKey,
      status: "pending",
    });
    return mapFriendshipDocument(document);
  }

  async accept(
    friendshipId: Types.ObjectId,
    recipientId: Types.ObjectId,
    acceptedAt: Date,
  ): Promise<StoredFriendship | null> {
    const document = await this.friendshipModel
      .findOneAndUpdate(
        {
          _id: friendshipId,
          recipientId,
          status: "pending",
        },
        {
          $set: {
            status: "accepted",
            acceptedAt,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapFriendshipDocument(document) : null;
  }

  async reject(
    friendshipId: Types.ObjectId,
    recipientId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.friendshipModel
      .deleteOne({
        _id: friendshipId,
        recipientId,
        status: "pending",
      })
      .exec();
    return result.deletedCount === 1;
  }

  async deleteForParticipant(
    friendshipId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.friendshipModel
      .deleteOne({
        _id: friendshipId,
        $or: [{ requesterId: userId }, { recipientId: userId }],
      })
      .exec();
    return result.deletedCount === 1;
  }
}

function mapFriendshipDocument(
  document: HydratedDocument<FriendshipDocument>,
): StoredFriendship {
  return {
    _id: document._id,
    requesterId: document.requesterId,
    recipientId: document.recipientId,
    pairKey: document.pairKey,
    status: document.status,
    createdAt: document.createdAt,
    ...(document.acceptedAt === undefined
      ? {}
      : { acceptedAt: document.acceptedAt }),
  };
}
