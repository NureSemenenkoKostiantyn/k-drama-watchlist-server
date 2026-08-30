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
