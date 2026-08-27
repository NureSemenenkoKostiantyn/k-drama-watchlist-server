export const PUBLIC_DISCOVERY_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

export const PUBLIC_RESOURCE_CACHE_CONTROL =
  "public, max-age=0, must-revalidate";

export const UNLISTED_RESOURCE_CACHE_CONTROL = "private, no-store";

export interface CacheControlResponse {
  setHeader(name: string, value: string): void;
}

export function setShareableResourceCacheControl(
  response: CacheControlResponse,
  visibility: "public" | "unlisted",
): void {
  response.setHeader(
    "Cache-Control",
    visibility === "public"
      ? PUBLIC_RESOURCE_CACHE_CONTROL
      : UNLISTED_RESOURCE_CACHE_CONTROL,
  );
}
