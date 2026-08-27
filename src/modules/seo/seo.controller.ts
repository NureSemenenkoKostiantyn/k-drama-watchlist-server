import { Controller, Get, Header } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { SeoService } from "./seo.service";

@Controller("public/seo")
@AllowAnonymous()
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  @Header(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  )
  sitemap(): Promise<string> {
    return this.seoService.renderSitemap();
  }
}
