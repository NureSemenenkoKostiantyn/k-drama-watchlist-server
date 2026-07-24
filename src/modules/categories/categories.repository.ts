import { Inject, Injectable } from "@nestjs/common";
import {
  type HydratedDocument,
  type Model,
  Types,
} from "mongoose";

import { CATEGORY_MODEL } from "./category-model.provider";
import { type CategoryDocument } from "./schema/category.schema";

export interface StoredCategory {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  slug: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryPersistenceUpdate {
  name?: string;
  slug?: string;
  icon?: string | null;
}

interface CategoryAssignmentDocument {
  userId: Types.ObjectId;
  categoryIds: Types.ObjectId[];
}

@Injectable()
export class CategoriesRepository {
  constructor(
    @Inject(CATEGORY_MODEL)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async findAll(userId: Types.ObjectId): Promise<StoredCategory[]> {
    const documents = await this.categoryModel
      .find({ userId })
      .sort({ name: 1 })
      .exec();
    return documents.map(mapCategoryDocument);
  }

  async findByIds(
    userId: Types.ObjectId,
    categoryIds: Types.ObjectId[],
  ): Promise<StoredCategory[]> {
    const documents = await this.categoryModel
      .find({
        _id: { $in: categoryIds },
        userId,
      })
      .exec();
    return documents.map(mapCategoryDocument);
  }

  async create(
    userId: Types.ObjectId,
    name: string,
    slug: string,
    icon?: string,
  ): Promise<StoredCategory> {
    const document = await this.categoryModel.create({
      userId,
      name,
      slug,
      ...(icon === undefined ? {} : { icon }),
    });
    return mapCategoryDocument(document);
  }

  async update(
    userId: Types.ObjectId,
    categoryId: Types.ObjectId,
    input: CategoryPersistenceUpdate,
  ): Promise<StoredCategory | null> {
    const setValues: Record<string, unknown> = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.icon === undefined || input.icon === null
        ? {}
        : { icon: input.icon }),
    };
    const document = await this.categoryModel
      .findOneAndUpdate(
        { _id: categoryId, userId },
        {
          ...(Object.keys(setValues).length === 0
            ? {}
            : { $set: setValues }),
          ...(input.icon === null ? { $unset: { icon: 1 } } : {}),
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      )
      .exec();
    return document ? mapCategoryDocument(document) : null;
  }

  async delete(
    userId: Types.ObjectId,
    categoryId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.categoryModel
      .deleteOne({ _id: categoryId, userId })
      .exec();

    if (result.deletedCount !== 1) {
      return false;
    }

    await this.categoryModel.db
      .collection<CategoryAssignmentDocument>("userMedia")
      .updateMany(
        {
          userId,
          categoryIds: categoryId,
        },
        {
          $pull: {
            categoryIds: categoryId,
          },
        },
      );
    return true;
  }
}

function mapCategoryDocument(
  document: HydratedDocument<CategoryDocument>,
): StoredCategory {
  return {
    _id: document._id,
    userId: document.userId,
    name: document.name,
    slug: document.slug,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.icon === undefined ? {} : { icon: document.icon }),
  };
}
