import { type CategoryResponse } from "./category.types";
import { type LibraryEntryResponse } from "./library.types";
import { type PriorityLaneResponse } from "./priority.types";
import { type UserSettingsResponse } from "./settings.types";

export interface AccountDataExportProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  username?: string;
  displayUsername?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDataExportResponse {
  format: "drama-watch-account-export";
  version: 1;
  exportedAt: string;
  account: AccountDataExportProfile;
  settings: UserSettingsResponse;
  categories: CategoryResponse[];
  priorityLanes: PriorityLaneResponse[];
  library: LibraryEntryResponse[];
}
