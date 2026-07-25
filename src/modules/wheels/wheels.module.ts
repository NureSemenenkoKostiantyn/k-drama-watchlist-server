import { Module } from "@nestjs/common";

import { MediaModule } from "../media/media.module";
import { wheelModelProviders } from "./wheel-model.providers";
import { WheelsController } from "./wheels.controller";
import { WheelsRepository } from "./wheels.repository";
import { WheelsService } from "./wheels.service";

@Module({
  imports: [MediaModule],
  controllers: [WheelsController],
  providers: [
    ...wheelModelProviders,
    WheelsRepository,
    WheelsService,
  ],
})
export class WheelsModule {}
