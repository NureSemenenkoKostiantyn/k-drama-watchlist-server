import { type PublicUserProfileResponse } from "./user.types";

export interface TelegramConnectionResponse {
  enabled: boolean;
  connected: boolean;
  botUsername?: string;
  miniAppUrl?: string;
  telegramUsername?: string;
  telegramDisplayName?: string;
  connectedAt?: string;
}

export interface TelegramLinkResponse {
  deepLink: string;
  expiresAt: string;
}

export interface TelegramMiniAppSessionResponse {
  account: PublicUserProfileResponse;
  telegramDisplayName: string;
  telegramUsername?: string;
}
