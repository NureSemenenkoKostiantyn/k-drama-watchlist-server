import { type ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";

import { type Environment } from "../../config/environment";
import { type SharedListsRepository } from "../shared-lists/shared-lists.repository";
import { type WheelsRepository } from "../wheels/wheels.repository";
import { SeoService } from "./seo.service";

describe("SeoService", () => {
  const findPublicListEntries = jest.fn<
    SharedListsRepository["findPublicSitemapEntries"]
  >();
  const findPublicWheelEntries = jest.fn<
    WheelsRepository["findPublicSitemapEntries"]
  >();
  const service = new SeoService(
    {
      getOrThrow: () => "https://dahyun.best/",
    } as unknown as ConfigService<Environment, true>,
    {
      findPublicSitemapEntries: findPublicListEntries,
    } as unknown as SharedListsRepository,
    {
      findPublicSitemapEntries: findPublicWheelEntries,
    } as unknown as WheelsRepository,
  );

  beforeEach(() => {
    findPublicListEntries.mockReset();
    findPublicWheelEntries.mockReset();
  });

  it("renders only the supplied public resources with canonical URLs", async () => {
    findPublicListEntries.mockResolvedValue([
      {
        publicSlug: "weekend-&-dramas",
        updatedAt: new Date("2026-08-24T10:00:00.000Z"),
      },
    ]);
    findPublicWheelEntries.mockResolvedValue([
      {
        publicSlug: "friday-wheel",
        updatedAt: new Date("2026-08-25T11:30:00.000Z"),
      },
    ]);

    const xml = await service.renderSitemap();

    expect(xml).toContain(
      "<loc>https://dahyun.best/lists/discover</loc>",
    );
    expect(xml).toContain(
      "<loc>https://dahyun.best/lists/public/weekend-%26-dramas</loc>",
    );
    expect(xml).toContain(
      "<loc>https://dahyun.best/wheels/public/friday-wheel</loc>",
    );
    expect(xml).toContain(
      "<lastmod>2026-08-24T10:00:00.000Z</lastmod>",
    );
    expect(findPublicListEntries).toHaveBeenCalledWith(24_999);
    expect(findPublicWheelEntries).toHaveBeenCalledWith(24_999);
  });
});
