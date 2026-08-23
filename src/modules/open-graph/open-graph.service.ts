import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type Environment } from "../../config/environment";
import {
  SharedListVisibility,
  type PublicSharedListDetailsResponse,
} from "../../common/types/shared-list.types";
import {
  WheelVisibility,
  type PublicWheelDetailsResponse,
} from "../../common/types/wheel.types";

interface OpenGraphDocumentInput {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  imageAlt?: string;
  allowIndexing: boolean;
}

@Injectable()
export class OpenGraphService {
  private readonly frontendUrl: string;

  constructor(configService: ConfigService<Environment, true>) {
    this.frontendUrl = configService
      .getOrThrow<string>("FRONTEND_URL")
      .replace(/\/+$/, "");
  }

  renderSharedList(list: PublicSharedListDetailsResponse): string {
    const canonicalUrl = `${this.frontendUrl}/lists/public/${encodeURIComponent(list.publicSlug)}`;
    const imageUrl = preferredMediaImage(list.items.map((item) => item.media));
    return renderDocument({
      title: `${list.title} · Drama Watch`,
      description: normalizeDescription(
        list.description,
        `Explore ${list.itemCount} ${list.itemCount === 1 ? "title" : "titles"} in ${list.title}, a shared Drama Watch list.`,
      ),
      canonicalUrl,
      ...(imageUrl === undefined ? {} : { imageUrl }),
      imageAlt: `Preview of ${list.title}`,
      allowIndexing: list.visibility === SharedListVisibility.Public,
    });
  }

  renderWheel(wheel: PublicWheelDetailsResponse): string {
    const canonicalUrl = `${this.frontendUrl}/wheels/public/${encodeURIComponent(wheel.publicSlug)}`;
    const imageUrl = preferredMediaImage(wheel.items.map((item) => item.media));
    return renderDocument({
      title: `${wheel.title} · Drama Watch`,
      description: normalizeDescription(
        wheel.description,
        `Explore ${wheel.itemCount} ${wheel.itemCount === 1 ? "candidate" : "candidates"} on ${wheel.title}, a Drama Watch wheel.`,
      ),
      canonicalUrl,
      ...(imageUrl === undefined ? {} : { imageUrl }),
      imageAlt: `Preview of ${wheel.title}`,
      allowIndexing: wheel.visibility === WheelVisibility.Public,
    });
  }
}

function preferredMediaImage(
  media: Array<{ backdropUrl?: string; posterUrl?: string }>,
): string | undefined {
  return (
    media.find((item) => item.backdropUrl)?.backdropUrl ??
    media.find((item) => item.posterUrl)?.posterUrl
  );
}

function normalizeDescription(
  description: string | undefined,
  fallback: string,
): string {
  const normalized = (description?.trim() || fallback).replace(/\s+/g, " ");
  return normalized.length <= 200
    ? normalized
    : `${normalized.slice(0, 199).trimEnd()}…`;
}

function renderDocument(input: OpenGraphDocumentInput): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const canonicalUrl = escapeHtml(input.canonicalUrl);
  const robots = input.allowIndexing
    ? "index, follow"
    : "noindex, nofollow";
  const imageTags = input.imageUrl
    ? [
        `<meta property="og:image" content="${escapeHtml(input.imageUrl)}">`,
        `<meta property="og:image:alt" content="${escapeHtml(input.imageAlt ?? input.title)}">`,
        `<meta name="twitter:image" content="${escapeHtml(input.imageUrl)}">`,
      ].join("\n    ")
    : "";
  const redirectTarget = JSON.stringify(input.canonicalUrl).replace(
    /</g,
    "\\u003c",
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Drama Watch">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonicalUrl}">
    ${imageTags}
    <meta name="twitter:card" content="${input.imageUrl ? "summary_large_image" : "summary"}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <noscript><meta http-equiv="refresh" content="0;url=${canonicalUrl}"></noscript>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${description}</p>
      <a href="${canonicalUrl}">Open on Drama Watch</a>
    </main>
    <script>window.location.replace(${redirectTarget});</script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}
