import { HttpStatus, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import { type CategoryResponse } from "../../common/types/category.types";
import { type CreateCategoryDto } from "./dto/create-category.dto";
import { type UpdateCategoryDto } from "./dto/update-category.dto";
import {
  CategoriesRepository,
  type StoredCategory,
} from "./categories.repository";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async list(authenticatedUserId: string): Promise<CategoryResponse[]> {
    const categories = await this.categoriesRepository.findAll(
      toObjectId(authenticatedUserId),
    );
    return categories.map(toCategoryResponse);
  }

  async create(
    authenticatedUserId: string,
    input: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    const icon = normalizeOptionalText(input.icon);
    const slug = requireCategorySlug(input.name);

    try {
      const category = await this.categoriesRepository.create(
        toObjectId(authenticatedUserId),
        input.name,
        slug,
        icon,
      );
      return toCategoryResponse(category);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw categoryAlreadyExists();
      }

      throw error;
    }
  }

  async update(
    authenticatedUserId: string,
    categoryId: string,
    input: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    if (input.name === undefined && input.icon === undefined) {
      throw invalidCategory("Provide a category field to update.");
    }

    try {
      const slug =
        input.name === undefined
          ? undefined
          : requireCategorySlug(input.name);
      const category = await this.categoriesRepository.update(
        toObjectId(authenticatedUserId),
        new Types.ObjectId(categoryId),
        {
          ...(input.name === undefined
            ? {}
            : {
                name: input.name,
                slug,
              }),
          ...(input.icon === undefined
            ? {}
            : { icon: normalizeOptionalText(input.icon) ?? null }),
        },
      );

      if (!category) {
        throw categoryNotFound();
      }

      return toCategoryResponse(category);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw categoryAlreadyExists();
      }

      throw error;
    }
  }

  async delete(
    authenticatedUserId: string,
    categoryId: string,
  ): Promise<void> {
    const deleted = await this.categoriesRepository.delete(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(categoryId),
    );

    if (!deleted) {
      throw categoryNotFound();
    }
  }

  async resolveOwnedIds(
    authenticatedUserId: string,
    categoryIds: string[],
  ): Promise<Types.ObjectId[]> {
    const uniqueIds = [...new Set(categoryIds)].map(
      (categoryId) => new Types.ObjectId(categoryId),
    );

    if (uniqueIds.length === 0) {
      return [];
    }

    const categories = await this.categoriesRepository.findByIds(
      toObjectId(authenticatedUserId),
      uniqueIds,
    );

    if (categories.length !== uniqueIds.length) {
      throw invalidCategory(
        "One or more selected categories are unavailable.",
      );
    }

    return uniqueIds;
  }
}

export function slugifyCategoryName(name: string): string {
  return name
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function requireCategorySlug(name: string): string {
  const slug = slugifyCategoryName(name);

  if (!slug) {
    throw invalidCategory(
      "Category name must contain at least one letter or number.",
    );
  }

  return slug;
}

function toCategoryResponse(
  category: StoredCategory,
): CategoryResponse {
  return {
    id: category._id.toHexString(),
    name: category.name,
    slug: category.slug,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    ...(category.icon === undefined ? {} : { icon: category.icon }),
  };
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

function categoryAlreadyExists(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "CATEGORY_ALREADY_EXISTS",
    message: "A category with this name already exists.",
  });
}

function categoryNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Category not found.",
  });
}

function invalidCategory(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message,
  });
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
