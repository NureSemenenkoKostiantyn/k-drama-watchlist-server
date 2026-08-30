import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type TelegramConnectionDocument,
  TelegramConnectionSchema,
} from "./schema/telegram-connection.schema";
import {
  type TelegramLinkTokenDocument,
  TelegramLinkTokenSchema,
} from "./schema/telegram-link-token.schema";
import {
  type TelegramProcessedUpdateDocument,
  TelegramProcessedUpdateSchema,
} from "./schema/telegram-processed-update.schema";

export const TELEGRAM_CONNECTION_MODEL = Symbol(
  "TELEGRAM_CONNECTION_MODEL",
);
export const TELEGRAM_LINK_TOKEN_MODEL = Symbol(
  "TELEGRAM_LINK_TOKEN_MODEL",
);
export const TELEGRAM_PROCESSED_UPDATE_MODEL = Symbol(
  "TELEGRAM_PROCESSED_UPDATE_MODEL",
);

export const telegramModelProviders: Provider[] = [
  {
    provide: TELEGRAM_CONNECTION_MODEL,
    inject: [getConnectionToken()],
    useFactory: (
      connection: Connection,
    ): Model<TelegramConnectionDocument> =>
      connection.model(
        "TelegramConnection",
        TelegramConnectionSchema,
      ),
  },
  {
    provide: TELEGRAM_LINK_TOKEN_MODEL,
    inject: [getConnectionToken()],
    useFactory: (
      connection: Connection,
    ): Model<TelegramLinkTokenDocument> =>
      connection.model(
        "TelegramLinkToken",
        TelegramLinkTokenSchema,
      ),
  },
  {
    provide: TELEGRAM_PROCESSED_UPDATE_MODEL,
    inject: [getConnectionToken()],
    useFactory: (
      connection: Connection,
    ): Model<TelegramProcessedUpdateDocument> =>
      connection.model(
        "TelegramProcessedUpdate",
        TelegramProcessedUpdateSchema,
      ),
  },
];
