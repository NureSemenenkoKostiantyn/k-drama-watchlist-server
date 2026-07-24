import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type MediaDocument,
  MediaSchema,
} from "./schema/media.schema";

export const MEDIA_MODEL_NAME = "Media";
export const MEDIA_MODEL = Symbol("MEDIA_MODEL");

export const mediaModelProvider: Provider<Model<MediaDocument>> = {
  provide: MEDIA_MODEL,
  inject: [getConnectionToken()],
  useFactory: (connection: Connection): Model<MediaDocument> =>
    connection.model<MediaDocument>(MEDIA_MODEL_NAME, MediaSchema),
};
