import { Inject, Injectable } from "@nestjs/common";
import { type HydratedDocument, type Model, Types } from "mongoose";

import {
  ActivityVisibility,
  LibraryVisibility,
  TierBoardMode,
} from "../../common/types/settings.types";
import { type UpdateSettingsDto } from "./dto/update-settings.dto";
import { type UserSettingsDocument } from "./schema/user-settings.schema";
import { USER_SETTINGS_MODEL } from "./user-settings-model.provider";

export interface StoredUserSettings {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  libraryVisibility: LibraryVisibility;
  activityVisibility: ActivityVisibility;
  tierBoardMode: TierBoardMode;
  telegramNotifications: {
    friendRequests: boolean;
    titleSuggestions: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SettingsRepository {
  constructor(
    @Inject(USER_SETTINGS_MODEL)
    private readonly settingsModel: Model<UserSettingsDocument>,
  ) {}

  async findByUserId(
    userId: Types.ObjectId,
  ): Promise<StoredUserSettings | null> {
    const document = await this.settingsModel.findOne({ userId }).exec();
    return document ? mapSettingsDocument(document) : null;
  }

  async findByUserIds(
    userIds: Types.ObjectId[],
  ): Promise<StoredUserSettings[]> {
    if (userIds.length === 0) return [];
    const documents = await this.settingsModel
      .find({ userId: { $in: userIds } })
      .exec();
    return documents.map(mapSettingsDocument);
  }

  async update(
    userId: Types.ObjectId,
    input: UpdateSettingsDto,
  ): Promise<StoredUserSettings> {
    const fields: Record<string, unknown> = {};
    const insertDefaults: Record<string, unknown> = { userId };
    if (input.libraryVisibility !== undefined) {
      fields.libraryVisibility = input.libraryVisibility;
    } else {
      insertDefaults.libraryVisibility = LibraryVisibility.Private;
    }
    if (input.activityVisibility !== undefined) {
      fields.activityVisibility = input.activityVisibility;
    } else {
      insertDefaults.activityVisibility = ActivityVisibility.Private;
    }
    if (input.tierBoardMode !== undefined) {
      fields.tierBoardMode = input.tierBoardMode;
    } else {
      insertDefaults.tierBoardMode = TierBoardMode.All;
    }
    if (input.telegramNotifications?.friendRequests !== undefined) {
      fields["telegramNotifications.friendRequests"] =
        input.telegramNotifications.friendRequests;
    } else {
      insertDefaults["telegramNotifications.friendRequests"] = false;
    }
    if (input.telegramNotifications?.titleSuggestions !== undefined) {
      fields["telegramNotifications.titleSuggestions"] =
        input.telegramNotifications.titleSuggestions;
    } else {
      insertDefaults["telegramNotifications.titleSuggestions"] = false;
    }

    const document = await this.settingsModel
      .findOneAndUpdate(
        { userId },
        {
          $set: fields,
          $setOnInsert: insertDefaults,
        },
        {
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: false,
          upsert: true,
        },
      )
      .exec();

    if (!document) {
      throw new Error("Settings update completed without a document");
    }

    return mapSettingsDocument(document);
  }
}

function mapSettingsDocument(
  document: HydratedDocument<UserSettingsDocument>,
): StoredUserSettings {
  return {
    _id: document._id,
    userId: document.userId,
    libraryVisibility: document.libraryVisibility,
    activityVisibility:
      document.activityVisibility ?? ActivityVisibility.Private,
    tierBoardMode: document.tierBoardMode ?? TierBoardMode.All,
    telegramNotifications: {
      friendRequests: document.telegramNotifications?.friendRequests ?? false,
      titleSuggestions:
        document.telegramNotifications?.titleSuggestions ?? false,
    },
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
