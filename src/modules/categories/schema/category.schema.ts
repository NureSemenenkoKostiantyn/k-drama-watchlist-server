import { Schema, type Types } from "mongoose";

export interface CategoryDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  slug: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CategorySchema = new Schema<CategoryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      maxlength: 120,
    },
    icon: {
      type: String,
      maxlength: 100,
    },
  },
  {
    collection: "categories",
    timestamps: true,
    versionKey: false,
  },
);

CategorySchema.index({ userId: 1, slug: 1 }, { unique: true });
