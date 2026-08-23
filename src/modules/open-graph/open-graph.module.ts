import { Module } from "@nestjs/common";

import { OpenGraphService } from "./open-graph.service";

@Module({
  providers: [OpenGraphService],
  exports: [OpenGraphService],
})
export class OpenGraphModule {}
