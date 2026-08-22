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

import { COMMENT_MODEL } from "../comments/comment-model.provider";
import { type CommentDocument } from "../comments/schema/comment.schema";

import {
  SharedListItemStatus,
  SharedListRole,
  SharedListVisibility,
} from "../../common/types/shared-list.types";
import {
  type Environment,
  NodeEnvironment,
} from "../../config/environment";
import { type SharedListInviteDocument } from "./schema/shared-list-invite.schema";
import {
  type SharedListItemDocument,
  type SharedListProgressDocument,
} from "./schema/shared-list-item.schema";
import {
  type SharedListDocument,
  type SharedListMemberDocument,
} from "./schema/shared-list.schema";
import {
  SHARED_LIST_INVITE_MODEL,
  SHARED_LIST_ITEM_MODEL,
  SHARED_LIST_MODEL,
} from "./shared-list-model.providers";

export interface StoredSharedList {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  visibility: SharedListVisibility;
  publicSlug?: string;
  members: SharedListMemberDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredSharedListItem {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  mediaId: Types.ObjectId;
  addedByUserId: Types.ObjectId;
  position: number;
  note?: string;
  groupStatus?: SharedListItemStatus;
  groupProgress?: SharedListProgressDocument;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredSharedListInvite {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  tokenHash: string;
  role: Exclude<SharedListRole, SharedListRole.Owner>;
  expiresAt: Date;
  createdAt: Date;
}

export interface SharedListUpdate {
  title?: string;
  description?: string | null;
}

export interface SharedListItemUpdate {
  note?: string | null;
  groupStatus?: SharedListItemStatus | null;
  groupProgress?: SharedListProgressDocument | null;
}

@Injectable()
export class SharedListsRepository {
  constructor(
    @Inject(SHARED_LIST_MODEL)
    private readonly listModel: Model<SharedListDocument>,
    @Inject(SHARED_LIST_ITEM_MODEL)
    private readonly itemModel: Model<SharedListItemDocument>,
    @Inject(SHARED_LIST_INVITE_MODEL)
    private readonly inviteModel: Model<SharedListInviteDocument>,
    @Inject(COMMENT_MODEL)
    private readonly commentModel: Model<CommentDocument>,
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

  async findAll(userId: Types.ObjectId): Promise<StoredSharedList[]> {
    const documents = await this.listModel
      .find({
        $or: [{ ownerId: userId }, { "members.userId": userId }],
      })
      .sort({ updatedAt: -1 })
      .exec();
    return documents.map(mapList);
  }

  async findById(
    userId: Types.ObjectId,
    listId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<StoredSharedList | null> {
    const query = this.listModel.findOne({
      _id: listId,
      $or: [{ ownerId: userId }, { "members.userId": userId }],
    });
    if (session) query.session(session);
    const document = await query.exec();
    return document ? mapList(document) : null;
  }

  async create(
    ownerId: Types.ObjectId,
    title: string,
    description: string | undefined,
    now: Date,
  ): Promise<StoredSharedList> {
    const document = await this.listModel.create({
      ownerId,
      title,
      ...(description === undefined ? {} : { description }),
      visibility: SharedListVisibility.Private,
      members: [{ userId: ownerId, role: SharedListRole.Owner, joinedAt: now }],
    });
    return mapList(document);
  }

  async update(
    ownerId: Types.ObjectId,
    listId: Types.ObjectId,
    input: SharedListUpdate,
  ): Promise<StoredSharedList | null> {
    const update = buildOptionalUpdate(input);
    const document = await this.listModel
      .findOneAndUpdate({ _id: listId, ownerId }, update, {
        returnDocument: "after",
        runValidators: true,
      })
      .exec();
    return document ? mapList(document) : null;
  }

  async delete(ownerId: Types.ObjectId, listId: Types.ObjectId): Promise<boolean> {
    const result = await this.listModel.deleteOne({ _id: listId, ownerId }).exec();
    if (result.deletedCount !== 1) return false;
    await Promise.all([
      this.itemModel.deleteMany({ listId }).exec(),
      this.inviteModel.deleteMany({ listId }).exec(),
      this.commentModel.deleteMany({ listId }).exec(),
    ]);
    return true;
  }

  async touch(listId: Types.ObjectId): Promise<void> {
    await this.listModel
      .updateOne({ _id: listId }, { $set: { updatedAt: new Date() } })
      .exec();
  }

  async findItems(listId: Types.ObjectId): Promise<StoredSharedListItem[]> {
    const documents = await this.itemModel
      .find({ listId })
      .sort({ position: 1 })
      .exec();
    return documents.map(mapItem);
  }

  async findItem(
    listId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<StoredSharedListItem | null> {
    const document = await this.itemModel.findOne({ _id: itemId, listId }).exec();
    return document ? mapItem(document) : null;
  }

  async findItemsForLists(
    listIds: Types.ObjectId[],
  ): Promise<StoredSharedListItem[]> {
    if (listIds.length === 0) return [];
    const documents = await this.itemModel
      .find({ listId: { $in: listIds } })
      .sort({ position: 1 })
      .exec();
    return documents.map(mapItem);
  }

  async createItem(
    listId: Types.ObjectId,
    mediaId: Types.ObjectId,
    addedByUserId: Types.ObjectId,
    position: number,
    input: SharedListItemUpdate,
  ): Promise<StoredSharedListItem> {
    const document = await this.itemModel.create({
      listId,
      mediaId,
      addedByUserId,
      position,
      ...(input.note ? { note: input.note } : {}),
      ...(input.groupStatus ? { groupStatus: input.groupStatus } : {}),
      ...(input.groupProgress ? { groupProgress: input.groupProgress } : {}),
    });
    return mapItem(document);
  }

  async updateItem(
    listId: Types.ObjectId,
    itemId: Types.ObjectId,
    input: SharedListItemUpdate,
  ): Promise<StoredSharedListItem | null> {
    const document = await this.itemModel
      .findOneAndUpdate(
        { _id: itemId, listId },
        buildOptionalUpdate(input),
        { returnDocument: "after", runValidators: true },
      )
      .exec();
    return document ? mapItem(document) : null;
  }

  async deleteItem(listId: Types.ObjectId, itemId: Types.ObjectId): Promise<boolean> {
    const result = await this.itemModel.deleteOne({ _id: itemId, listId }).exec();
    return result.deletedCount === 1;
  }

  async reorderItems(listId: Types.ObjectId, itemIds: Types.ObjectId[]): Promise<void> {
    if (itemIds.length === 0) return;
    await this.itemModel.bulkWrite(
      itemIds.map((itemId, position) => ({
        updateOne: {
          filter: { _id: itemId, listId },
          update: { $set: { position } },
        },
      })),
    );
  }

  async createInvite(
    listId: Types.ObjectId,
    createdByUserId: Types.ObjectId,
    tokenHash: string,
    role: Exclude<SharedListRole, SharedListRole.Owner>,
    expiresAt: Date,
  ): Promise<StoredSharedListInvite> {
    const document = await this.inviteModel.create({
      listId,
      createdByUserId,
      tokenHash,
      role,
      expiresAt,
    });
    return mapInvite(document);
  }

  async findInviteByTokenHash(
    tokenHash: string,
    session?: ClientSession,
  ): Promise<StoredSharedListInvite | null> {
    const query = this.inviteModel.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });
    if (session) query.session(session);
    const document = await query.exec();
    return document ? mapInvite(document) : null;
  }

  async addMember(
    listId: Types.ObjectId,
    userId: Types.ObjectId,
    role: Exclude<SharedListRole, SharedListRole.Owner>,
    joinedAt: Date,
    session?: ClientSession,
  ): Promise<StoredSharedList | null> {
    const query = this.listModel.findOneAndUpdate(
      { _id: listId, "members.userId": { $ne: userId } },
      { $push: { members: { userId, role, joinedAt } } },
      { returnDocument: "after", runValidators: true },
    );
    if (session) query.session(session);
    const document = await query.exec();
    return document ? mapList(document) : null;
  }

  async deleteInvite(inviteId: Types.ObjectId, session?: ClientSession): Promise<void> {
    const query = this.inviteModel.deleteOne({ _id: inviteId });
    if (session) query.session(session);
    await query.exec();
  }
}

function buildOptionalUpdate<T extends object>(
  input: T,
): UpdateQuery<SharedListDocument | SharedListItemDocument> {
  const setValues: Record<string, unknown> = {};
  const unsetValues: Record<string, 1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null) unsetValues[key] = 1;
    else if (value !== undefined) setValues[key] = value;
  }
  return {
    ...(Object.keys(setValues).length ? { $set: setValues } : {}),
    ...(Object.keys(unsetValues).length ? { $unset: unsetValues } : {}),
  };
}

function mapList(document: HydratedDocument<SharedListDocument>): StoredSharedList {
  return {
    _id: document._id,
    ownerId: document.ownerId,
    title: document.title,
    visibility: document.visibility,
    members: document.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
    })),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.description === undefined ? {} : { description: document.description }),
    ...(document.publicSlug === undefined ? {} : { publicSlug: document.publicSlug }),
  };
}

function mapItem(
  document: HydratedDocument<SharedListItemDocument>,
): StoredSharedListItem {
  return {
    _id: document._id,
    listId: document.listId,
    mediaId: document.mediaId,
    addedByUserId: document.addedByUserId,
    position: document.position,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.note === undefined ? {} : { note: document.note }),
    ...(document.groupStatus === undefined ? {} : { groupStatus: document.groupStatus }),
    ...(document.groupProgress === undefined
      ? {}
      : {
          groupProgress: {
            currentSeason: document.groupProgress.currentSeason,
            currentEpisode: document.groupProgress.currentEpisode,
          },
        }),
  };
}

function mapInvite(
  document: HydratedDocument<SharedListInviteDocument>,
): StoredSharedListInvite {
  return {
    _id: document._id,
    listId: document.listId,
    createdByUserId: document.createdByUserId,
    tokenHash: document.tokenHash,
    role: document.role,
    expiresAt: document.expiresAt,
    createdAt: document.createdAt,
  };
}
