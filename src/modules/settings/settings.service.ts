import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import {
  LibraryVisibility,
  type UserSettingsResponse,
} from "../../common/types/settings.types";
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
    };
  }

  async update(
    authenticatedUserId: string,
    input: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    const settings = await this.settingsRepository.update(
      toObjectId(authenticatedUserId),
      input.libraryVisibility,
    );

    return {
      libraryVisibility: settings.libraryVisibility,
    };
  }
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}
