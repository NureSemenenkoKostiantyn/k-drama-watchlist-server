import { Module } from "@nestjs/common";

import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { SharedListsModule } from "../shared-lists/shared-lists.module";
import { StatisticsModule } from "../statistics/statistics.module";
import { WheelsModule } from "../wheels/wheels.module";
import {
  McpController,
  McpWellKnownController,
} from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
  imports: [
    LibraryModule,
    MediaModule,
    SharedListsModule,
    StatisticsModule,
    WheelsModule,
  ],
  controllers: [McpController, McpWellKnownController],
  providers: [McpService],
})
export class McpModule {}
