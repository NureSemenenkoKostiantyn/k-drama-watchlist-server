import { Module } from "@nestjs/common";

import { LibraryModule } from "../library/library.module";
import { StatisticsController } from "./statistics.controller";
import { StatisticsRepository } from "./statistics.repository";
import { StatisticsService } from "./statistics.service";

@Module({
  imports: [LibraryModule],
  controllers: [StatisticsController],
  providers: [StatisticsRepository, StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
