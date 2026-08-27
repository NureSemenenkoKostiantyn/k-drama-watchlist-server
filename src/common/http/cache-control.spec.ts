import { jest } from "@jest/globals";

import {
  PUBLIC_RESOURCE_CACHE_CONTROL,
  setShareableResourceCacheControl,
  UNLISTED_RESOURCE_CACHE_CONTROL,
} from "./cache-control";

describe("setShareableResourceCacheControl", () => {
  it.each([
    ["public", PUBLIC_RESOURCE_CACHE_CONTROL],
    ["unlisted", UNLISTED_RESOURCE_CACHE_CONTROL],
  ] as const)("sets the %s resource policy", (visibility, expected) => {
    const response = { setHeader: jest.fn() };

    setShareableResourceCacheControl(response, visibility);

    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", expected);
  });
});
