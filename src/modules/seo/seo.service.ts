import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type Environment } from "../../config/environment";
import { SharedListsRepository } from "../shared-lists/shared-lists.repository";
import { WheelsRepository } from "../wheels/wheels.repository";

const maximumEntriesPerResource = 24_999;

interface SitemapUrl {
  location: string;
  lastModified?: Date;
}

@Injectable()
export class SeoService {
  private readonly frontendUrl: string;

  constructor(
    configService: ConfigService<Environment, true>,
    private readonly sharedListsRepository: SharedListsRepository,
    private readonly wheelsRepository: WheelsRepository,
  ) {
    this.frontendUrl = configService
      .getOrThrow<string>("FRONTEND_URL")
      .replace(/\/+$/, "");
  }

  async renderSitemap(): Promise<string> {
    const [lists, wheels] = await Promise.all([
      this.sharedListsRepository.findPublicSitemapEntries(
        maximumEntriesPerResource,
      ),
      this.wheelsRepository.findPublicSitemapEntries(
        maximumEntriesPerResource,
      ),
    ]);
    const urls: SitemapUrl[] = [
      { location: `${this.frontendUrl}/lists/discover` },
      ...lists.map((list) => ({
        location: `${this.frontendUrl}/lists/public/${encodeURIComponent(list.publicSlug)}`,
        lastModified: list.updatedAt,
      })),
      ...wheels.map((wheel) => ({
        location: `${this.frontendUrl}/wheels/public/${encodeURIComponent(wheel.publicSlug)}`,
        lastModified: wheel.updatedAt,
      })),
    ];

    return renderSitemap(urls);
  }
}

function renderSitemap(urls: SitemapUrl[]): string {
  const entries = urls
    .map(
      ({ location, lastModified }) => `  <url>
    <loc>${escapeXml(location)}</loc>${
      lastModified
        ? `\n    <lastmod>${lastModified.toISOString()}</lastmod>`
        : ""
    }
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character] ?? character;
  });
}
