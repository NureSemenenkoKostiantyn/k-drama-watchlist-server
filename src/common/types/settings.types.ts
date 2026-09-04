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

export interface TelegramNotificationSettings {
  friendRequests: boolean;
  titleSuggestions: boolean;
}

export interface UserSettingsResponse {
  libraryVisibility: LibraryVisibility;
  activityVisibility: ActivityVisibility;
  telegramNotifications: TelegramNotificationSettings;
}
