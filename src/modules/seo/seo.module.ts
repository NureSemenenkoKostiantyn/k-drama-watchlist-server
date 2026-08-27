import { Module } from "@nestjs/common";

import { SharedListsModule } from "../shared-lists/shared-lists.module";
import { WheelsModule } from "../wheels/wheels.module";
import { SeoController } from "./seo.controller";
import { SeoService } from "./seo.service";

@Module({
  imports: [SharedListsModule, WheelsModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
