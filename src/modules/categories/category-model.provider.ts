import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type CategoryDocument,
  CategorySchema,
} from "./schema/category.schema";

export const CATEGORY_MODEL_NAME = "Category";
export const CATEGORY_MODEL = Symbol("CATEGORY_MODEL");

export const categoryModelProvider: Provider<Model<CategoryDocument>> = {
  provide: CATEGORY_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<CategoryDocument> =>
    connection.model<CategoryDocument>(
      CATEGORY_MODEL_NAME,
      CategorySchema,
    ),
};
