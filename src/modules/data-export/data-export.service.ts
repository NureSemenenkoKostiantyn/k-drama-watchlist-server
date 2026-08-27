import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { type AccountDataExportResponse } from "../../common/types/data-export.types";
import { CategoriesService } from "../categories/categories.service";
import { LibraryService } from "../library/library.service";
import { PriorityRepository } from "../priority/priority.repository";
import { SettingsService } from "../settings/settings.service";
import {
  DataExportRepository,
  type StoredExportAccount,
} from "./data-export.repository";

@Injectable()
export class DataExportService {
  constructor(
    private readonly dataExportRepository: DataExportRepository,
    private readonly settingsService: SettingsService,
    private readonly categoriesService: CategoriesService,
    private readonly priorityRepository: PriorityRepository,
    private readonly libraryService: LibraryService,
  ) {}

  async exportAccount(
    authenticatedUserId: string,
  ): Promise<AccountDataExportResponse> {
    const userId = toObjectId(authenticatedUserId);
    const [account, settings, categories, priorityLanes, library] =
      await Promise.all([
        this.dataExportRepository.findAccountById(userId),
        this.settingsService.get(authenticatedUserId),
        this.categoriesService.list(authenticatedUserId),
        this.priorityRepository.findAll(userId),
        this.libraryService.list(authenticatedUserId),
      ]);

    if (!account) {
      throw new Error("Authenticated account was not found during export");
    }

    return {
      format: "drama-watch-account-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: toExportProfile(account),
      settings,
      categories,
      priorityLanes: priorityLanes.map((lane) => ({
        id: lane._id.toHexString(),
        name: lane.name,
        position: lane.position,
        isDefault: lane.isDefault,
        createdAt: lane.createdAt.toISOString(),
        updatedAt: lane.updatedAt.toISOString(),
      })),
      library,
    };
  }
}

function toExportProfile(
  account: StoredExportAccount,
): AccountDataExportResponse["account"] {
  return {
    id: account._id.toHexString(),
    email: account.email,
    emailVerified: account.emailVerified,
    name: account.name,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    ...(account.username === undefined
      ? {}
      : { username: account.username }),
    ...(account.displayUsername === undefined
      ? {}
      : { displayUsername: account.displayUsername }),
    ...(typeof account.image === "string" && account.image
      ? { image: account.image }
      : {}),
  };
}

function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new ObjectId(id);
}
