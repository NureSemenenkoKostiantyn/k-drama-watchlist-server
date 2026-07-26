import { Module } from "@nestjs/common";

import { TmdbModule } from "../../integrations/tmdb/tmdb.module";
import { discoveryCacheModelProvider } from "./discovery-cache-model.provider";
import { DiscoveryCacheRepository } from "./discovery-cache.repository";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [TmdbModule],
  controllers: [DiscoveryController],
  providers: [
    discoveryCacheModelProvider,
    DiscoveryCacheRepository,
    DiscoveryService,
  ],
})
export class DiscoveryModule {}
