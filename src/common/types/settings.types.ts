export enum LibraryVisibility {
  Friends = "friends",
  Private = "private",
  Public = "public",
}

export enum ActivityVisibility {
  Friends = "friends",
  Private = "private",
  Public = "public",
}

export enum TierBoardMode {
  All = "all",
  KDrama = "kdrama",
  Both = "both",
}

export interface TelegramNotificationSettings {
  friendRequests: boolean;
  titleSuggestions: boolean;
}

export interface UserSettingsResponse {
  libraryVisibility: LibraryVisibility;
  activityVisibility: ActivityVisibility;
  tierBoardMode: TierBoardMode;
  telegramNotifications: TelegramNotificationSettings;
}
