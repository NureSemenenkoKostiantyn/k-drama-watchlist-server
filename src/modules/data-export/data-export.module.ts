import { Module } from "@nestjs/common";

import { CategoriesModule } from "../categories/categories.module";
import { LibraryModule } from "../library/library.module";
import { PriorityModule } from "../priority/priority.module";
import { SettingsModule } from "../settings/settings.module";
import { DataExportController } from "./data-export.controller";
import { DataExportRepository } from "./data-export.repository";
import { DataExportService } from "./data-export.service";

@Module({
  imports: [
    CategoriesModule,
    LibraryModule,
    PriorityModule,
    SettingsModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportRepository, DataExportService],
})
export class DataExportModule {}
