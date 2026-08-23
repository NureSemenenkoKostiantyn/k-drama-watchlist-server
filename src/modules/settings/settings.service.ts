import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import {
  ActivityVisibility,
  LibraryVisibility,
  type UserSettingsResponse,
} from "../../common/types/settings.types";
import { ApiException } from "../../common/errors/api-exception";
import { type UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsRepository } from "./settings.repository";

@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
  ) {}

  get(authenticatedUserId: string): Promise<UserSettingsResponse> {
    return this.getForUser(toObjectId(authenticatedUserId));
  }

  async getForUser(
    userId: Types.ObjectId,
  ): Promise<UserSettingsResponse> {
    const settings =
      await this.settingsRepository.findByUserId(userId);

    return {
      libraryVisibility:
        settings?.libraryVisibility ?? LibraryVisibility.Private,
      activityVisibility:
        settings?.activityVisibility ?? ActivityVisibility.Private,
    };
  }

  async findVisibleFriendActivityUserIds(
    userIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    const settings = await this.settingsRepository.findByUserIds(userIds);
    return settings
      .filter(
        (entry) => entry.activityVisibility !== ActivityVisibility.Private,
      )
      .map((entry) => entry.userId);
  }

  async update(
    authenticatedUserId: string,
    input: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    if (
      input.libraryVisibility === undefined &&
      input.activityVisibility === undefined
    ) {
      throw settingsUpdateRequired();
    }
    const settings = await this.settingsRepository.update(
      toObjectId(authenticatedUserId),
      input,
    );

    return {
      libraryVisibility: settings.libraryVisibility,
      activityVisibility: settings.activityVisibility,
    };
  }
}

function settingsUpdateRequired(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "SETTINGS_UPDATE_REQUIRED",
    message: "Provide at least one setting to update.",
  });
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}
