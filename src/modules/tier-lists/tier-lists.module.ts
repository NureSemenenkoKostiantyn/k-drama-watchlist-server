import { Module } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection } from "mongoose";

import { MediaModule } from "../media/media.module";
import { OpenGraphModule } from "../open-graph/open-graph.module";
import { UsersModule } from "../users/users.module";
import {
  type TierListDocument,
  TierListSchema,
} from "./schema/tier-list.schema";
import {
  PublicTierListsController,
  TierListsController,
} from "./tier-lists.controller";
import { TIER_LIST_MODEL, TierListsRepository } from "./tier-lists.repository";
import { TierListsService } from "./tier-lists.service";

@Module({
  imports: [MediaModule, UsersModule, OpenGraphModule],
  controllers: [TierListsController, PublicTierListsController],
  providers: [
    TierListsRepository,
    TierListsService,
    {
      provide: TIER_LIST_MODEL,
      inject: [getConnectionToken()],
      useFactory: (connection: Connection) =>
        connection.model<TierListDocument>("TierList", TierListSchema),
    },
  ],
  exports: [TierListsRepository, TierListsService],
})
export class TierListsModule {}
