import { Module } from "@nestjs/common";

import { LibraryModule } from "../library/library.module";
import { priorityLaneModelProvider } from "./priority-lane-model.provider";
import { PriorityController } from "./priority.controller";
import { PriorityRepository } from "./priority.repository";
import { PriorityService } from "./priority.service";

@Module({
  imports: [LibraryModule],
  controllers: [PriorityController],
  providers: [
    priorityLaneModelProvider,
    PriorityRepository,
    PriorityService,
  ],
})
export class PriorityModule {}
