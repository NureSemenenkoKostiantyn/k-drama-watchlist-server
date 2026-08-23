import { type ConfigService } from "@nestjs/config";

import { MediaType } from "../../common/types/media.types";
import {
  SharedListVisibility,
  type PublicSharedListDetailsResponse,
} from "../../common/types/shared-list.types";
import {
  WheelSelectionMode,
  WheelVisibility,
  type PublicWheelDetailsResponse,
} from "../../common/types/wheel.types";
import { type Environment } from "../../config/environment";
import { OpenGraphService } from "./open-graph.service";

describe("OpenGraphService", () => {
  const service = new OpenGraphService({
    getOrThrow: () => "https://dahyun.best/",
  } as unknown as ConfigService<Environment, true>);

  it("renders escaped list metadata with a canonical redirect", () => {
    const html = service.renderSharedList(buildList());

    expect(html).toContain("Weekend &amp; &lt;script&gt; dramas · Drama Watch");
    expect(html).not.toContain("<script> dramas");
    expect(html).toContain(
      '<meta property="og:image" content="https://image.tmdb.org/backdrop.jpg">',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://dahyun.best/lists/public/weekend-list">',
    );
    expect(html).toContain('<meta name="robots" content="index, follow">');
    expect(html).toContain(
      'window.location.replace("https://dahyun.best/lists/public/weekend-list")',
    );
  });

  it("keeps an unlisted wheel out of indexes and falls back to a poster", () => {
    const html = service.renderWheel(buildWheel());

    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain(
      '<meta name="twitter:image" content="https://image.tmdb.org/poster.jpg">',
    );
    expect(html).toContain('content="summary_large_image"');
  });

  function buildList(): PublicSharedListDetailsResponse {
    return {
      title: "Weekend & <script> dramas",
      description: "A public list",
      visibility: SharedListVisibility.Public,
      publicSlug: "weekend-list",
      itemCount: 1,
      members: [],
      items: [
        {
          position: 0,
          media: {
            tmdbId: 1,
            mediaType: MediaType.Tv,
            title: "Goblin",
            originalTitle: "도깨비",
            originCountry: ["KR"],
            genreIds: [18],
            backdropUrl: "https://image.tmdb.org/backdrop.jpg",
          },
          createdAt: "2026-08-24T10:00:00.000Z",
          updatedAt: "2026-08-24T10:00:00.000Z",
        },
      ],
      createdAt: "2026-08-24T10:00:00.000Z",
      updatedAt: "2026-08-24T10:00:00.000Z",
    };
  }

  function buildWheel(): PublicWheelDetailsResponse {
    return {
      title: "Tonight",
      visibility: WheelVisibility.Unlisted,
      publicSlug: "tonight-wheel",
      selectionMode: WheelSelectionMode.FullyRandom,
      itemCount: 1,
      enabledItemCount: 1,
      members: [],
      history: [],
      items: [
        {
          position: 0,
          weight: 1,
          isEnabled: true,
          selectionCount: 0,
          media: {
            tmdbId: 1,
            mediaType: MediaType.Tv,
            title: "Goblin",
            originalTitle: "도깨비",
            originCountry: ["KR"],
            genreIds: [18],
            posterUrl: "https://image.tmdb.org/poster.jpg",
          },
          createdAt: "2026-08-24T10:00:00.000Z",
          updatedAt: "2026-08-24T10:00:00.000Z",
        },
      ],
      createdAt: "2026-08-24T10:00:00.000Z",
      updatedAt: "2026-08-24T10:00:00.000Z",
    };
  }
});
