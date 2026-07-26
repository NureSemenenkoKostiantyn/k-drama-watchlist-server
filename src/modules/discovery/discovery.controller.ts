import { Controller, Get, Header } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { type DiscoveryHomeResponse } from "../../common/types/discovery.types";
import { DiscoveryService } from "./discovery.service";

@Controller("discovery")
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get("home")
  @AllowAnonymous()
  @Header(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  )
  getHome(): Promise<DiscoveryHomeResponse> {
    return this.discoveryService.getHome();
  }
}
