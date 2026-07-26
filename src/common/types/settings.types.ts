export enum LibraryVisibility {
  Friends = "friends",
  Private = "private",
  Public = "public",
}

export interface UserSettingsResponse {
  libraryVisibility: LibraryVisibility;
}
