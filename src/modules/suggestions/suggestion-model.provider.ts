import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type SuggestionDocument,
  SuggestionSchema,
} from "./schema/suggestion.schema";

export const SUGGESTION_MODEL_NAME = "Suggestion";
export const SUGGESTION_MODEL = Symbol("SUGGESTION_MODEL");

export const suggestionModelProvider: Provider<Model<SuggestionDocument>> = {
  provide: SUGGESTION_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<SuggestionDocument> =>
    connection.model<SuggestionDocument>(
      SUGGESTION_MODEL_NAME,
      SuggestionSchema,
    ),
};
