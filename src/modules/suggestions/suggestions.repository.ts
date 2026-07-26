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
import { SuggestionStatus } from "../../common/types/suggestion.types";
import {
  type Environment,
  NodeEnvironment,
} from "../../config/environment";
import { USER_MEDIA_MODEL } from "../library/user-media-model.provider";
import { type UserMediaDocument } from "../library/schema/user-media.schema";
import { type SuggestionDocument } from "./schema/suggestion.schema";
import { SUGGESTION_MODEL } from "./suggestion-model.provider";

export interface StoredSuggestion {
  _id: Types.ObjectId;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  mediaId: Types.ObjectId;
  message?: string;
  status: SuggestionStatus;
  createdAt: Date;
  respondedAt?: Date;
}

@Injectable()
export class SuggestionsRepository {
  constructor(
    @Inject(SUGGESTION_MODEL)
    private readonly suggestionModel: Model<SuggestionDocument>,
    @Inject(USER_MEDIA_MODEL)
    private readonly userMediaModel: Model<UserMediaDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async findAllForUser(
    userId: Types.ObjectId,
  ): Promise<StoredSuggestion[]> {
    const documents = await this.suggestionModel
      .find({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
      })
      .sort({ createdAt: -1 })
      .exec();
    return documents.map(mapSuggestion);
  }

  async create(
    fromUserId: Types.ObjectId,
    toUserId: Types.ObjectId,
    mediaId: Types.ObjectId,
    message?: string,
  ): Promise<StoredSuggestion> {
    const document = await this.suggestionModel
      .findOneAndUpdate(
        {
          fromUserId,
          toUserId,
          mediaId,
          status: SuggestionStatus.Pending,
        },
        {
          ...(message === undefined
            ? { $unset: { message: 1 } }
            : { $set: { message } }),
          $setOnInsert: {
            fromUserId,
            toUserId,
            mediaId,
            status: SuggestionStatus.Pending,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        },
      )
      .orFail()
      .exec();
    return mapSuggestion(document);
  }

  async accept(
    suggestionId: Types.ObjectId,
    toUserId: Types.ObjectId,
    respondedAt: Date,
  ): Promise<StoredSuggestion | null> {
    return this.runInTransaction(async (session) => {
      const suggestion = await this.suggestionModel
        .findOne({
          _id: suggestionId,
          toUserId,
          status: SuggestionStatus.Pending,
        })
        .session(session ?? null)
        .exec();

      if (!suggestion) {
        return null;
      }

      await this.userMediaModel
        .updateOne(
          {
            userId: toUserId,
            mediaId: suggestion.mediaId,
          },
          {
            $setOnInsert: {
              userId: toUserId,
              mediaId: suggestion.mediaId,
              status: WatchStatus.ToWatch,
              categoryIds: [],
              suggestedByUserId: suggestion.fromUserId,
            },
          },
          {
            upsert: true,
            runValidators: true,
            ...(session === undefined ? {} : { session }),
          },
        )
        .exec();

      const updated = await this.suggestionModel
        .findOneAndUpdate(
          {
            _id: suggestionId,
            toUserId,
            status: SuggestionStatus.Pending,
          },
          {
            $set: {
              status: SuggestionStatus.Accepted,
              respondedAt,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            ...(session === undefined ? {} : { session }),
          },
        )
        .exec();

      return updated ? mapSuggestion(updated) : null;
    });
  }

  async dismiss(
    suggestionId: Types.ObjectId,
    toUserId: Types.ObjectId,
    respondedAt: Date,
  ): Promise<StoredSuggestion | null> {
    const document = await this.suggestionModel
      .findOneAndUpdate(
        {
          _id: suggestionId,
          toUserId,
          status: SuggestionStatus.Pending,
        },
        {
          $set: {
            status: SuggestionStatus.Dismissed,
            respondedAt,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapSuggestion(document) : null;
  }

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
}

function mapSuggestion(
  document: HydratedDocument<SuggestionDocument>,
): StoredSuggestion {
  return {
    _id: document._id,
    fromUserId: document.fromUserId,
    toUserId: document.toUserId,
    mediaId: document.mediaId,
    status: document.status,
    createdAt: document.createdAt,
    ...(document.message === undefined
      ? {}
      : { message: document.message }),
    ...(document.respondedAt === undefined
      ? {}
      : { respondedAt: document.respondedAt }),
  };
}
