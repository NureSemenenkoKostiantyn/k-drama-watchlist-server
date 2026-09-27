import { Inject, Injectable } from "@nestjs/common";
import { type Model, Types } from "mongoose";
import { TierListVisibility } from "../../common/types/tier-list.types";
import { type TierListDocument } from "./schema/tier-list.schema";

export const TIER_LIST_MODEL = Symbol("TIER_LIST_MODEL");
export type NewTierList = Omit<
  TierListDocument,
  "_id" | "createdAt" | "updatedAt"
>;

@Injectable()
export class TierListsRepository {
  constructor(
    @Inject(TIER_LIST_MODEL) private readonly model: Model<TierListDocument>,
  ) {}

  list(ownerId: Types.ObjectId): Promise<TierListDocument[]> {
    return this.model
      .find({ ownerId })
      .sort({ updatedAt: -1, _id: -1 })
      .lean<TierListDocument[]>()
      .exec();
  }

  async create(input: NewTierList): Promise<TierListDocument> {
    return (await this.model.create(input)).toObject();
  }

  findOwned(
    id: string,
    ownerId: Types.ObjectId,
  ): Promise<TierListDocument | null> {
    return this.model
      .findOne({ _id: id, ownerId })
      .lean<TierListDocument>()
      .exec();
  }

  findPublic(publicSlug: string): Promise<TierListDocument | null> {
    return this.model
      .findOne({
        publicSlug,
        visibility: {
          $in: [TierListVisibility.Public, TierListVisibility.Unlisted],
        },
      })
      .lean<TierListDocument>()
      .exec();
  }

  save(board: TierListDocument): Promise<TierListDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: board._id, ownerId: board.ownerId, revision: board.revision },
        {
          $set: {
            title: board.title,
            description: board.description,
            visibility: board.visibility,
            tiers: board.tiers,
            unrankedMediaIds: board.unrankedMediaIds,
            ...(board.publicSlug ? { publicSlug: board.publicSlug } : {}),
          },
          $inc: { revision: 1 },
          ...(!board.publicSlug ? { $unset: { publicSlug: 1 } } : {}),
        },
        { returnDocument: "after", runValidators: true },
      )
      .lean<TierListDocument>()
      .exec();
  }

  async delete(board: TierListDocument): Promise<boolean> {
    const result = await this.model
      .deleteOne({
        _id: board._id,
        ownerId: board.ownerId,
        revision: board.revision,
      })
      .exec();
    return result.deletedCount === 1;
  }

  findPublicSitemapEntries(
    limit: number,
  ): Promise<Array<{ publicSlug: string; updatedAt: Date }>> {
    return this.model
      .find({
        visibility: TierListVisibility.Public,
        publicSlug: { $type: "string" },
      })
      .select({ publicSlug: 1, updatedAt: 1, _id: 0 })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean<Array<{ publicSlug: string; updatedAt: Date }>>()
      .exec();
  }
}
