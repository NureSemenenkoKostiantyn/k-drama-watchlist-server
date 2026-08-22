import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type SharedListInviteDocument,
  SharedListInviteSchema,
} from "./schema/shared-list-invite.schema";
import {
  type SharedListItemDocument,
  SharedListItemSchema,
} from "./schema/shared-list-item.schema";
import {
  type SharedListDocument,
  SharedListSchema,
} from "./schema/shared-list.schema";

export const SHARED_LIST_MODEL = Symbol("SHARED_LIST_MODEL");
export const SHARED_LIST_ITEM_MODEL = Symbol("SHARED_LIST_ITEM_MODEL");
export const SHARED_LIST_INVITE_MODEL = Symbol("SHARED_LIST_INVITE_MODEL");

export const sharedListModelProviders: Provider[] = [
  {
    provide: SHARED_LIST_MODEL,
    inject: [getConnectionToken()],
    useFactory: (connection: Connection): Model<SharedListDocument> =>
      connection.model<SharedListDocument>("SharedList", SharedListSchema),
  },
  {
    provide: SHARED_LIST_ITEM_MODEL,
    inject: [getConnectionToken()],
    useFactory: (connection: Connection): Model<SharedListItemDocument> =>
      connection.model<SharedListItemDocument>(
        "SharedListItem",
        SharedListItemSchema,
      ),
  },
  {
    provide: SHARED_LIST_INVITE_MODEL,
    inject: [getConnectionToken()],
    useFactory: (connection: Connection): Model<SharedListInviteDocument> =>
      connection.model<SharedListInviteDocument>(
        "SharedListInvite",
        SharedListInviteSchema,
      ),
  },
];
