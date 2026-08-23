import { Schema, type Types } from "mongoose";

import {
  ActivityVisibility,
  LibraryVisibility,
} from "../../../common/types/settings.types";

export interface UserSettingsDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  libraryVisibility: LibraryVisibility;
  activityVisibility: ActivityVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSettingsSchema = new Schema<UserSettingsDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    libraryVisibility: {
      type: String,
      enum: Object.values(LibraryVisibility),
      default: LibraryVisibility.Private,
      required: true,
    },
    activityVisibility: {
      type: String,
      enum: Object.values(ActivityVisibility),
      default: ActivityVisibility.Private,
      required: true,
    },
  },
  {
    collection: "userSettings",
    timestamps: true,
    versionKey: false,
  },
);

UserSettingsSchema.index({ userId: 1 }, { unique: true });
