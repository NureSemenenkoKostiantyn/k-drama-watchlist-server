import { type HttpService } from "@nestjs/axios";
import { jest } from "@jest/globals";
import { of, throwError } from "rxjs";

import { MediaType, SearchMediaType } from "../../common/types/media.types";
import { TmdbClient } from "./tmdb.client";

describe("TmdbClient", () => {
  const get = jest.fn();
  const client = new TmdbClient({
    get,
  } as unknown as HttpService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the typed search endpoint without exposing the token in parameters", async () => {
    get.mockReturnValue(of({ data: { results: [] } }));

    await client.search({
      page: 2,
      query: "Goblin",
      type: SearchMediaType.Tv,
    });

    expect(get).toHaveBeenCalledWith("/search/tv", {
      params: {
        include_adult: false,
        page: 2,
        query: "Goblin",
      },
    });
  });

  it("maps a missing TMDB title to the public not-found error", async () => {
    get.mockReturnValue(
      throwError(() => ({
        isAxiosError: true,
        response: { status: 404 },
      })),
    );

    await expect(
      client.getDetails(MediaType.Movie, 123),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Media title not found.",
    });
  });

  it("maps other upstream failures without exposing their response", async () => {
    get.mockReturnValue(
      throwError(() => ({
        isAxiosError: true,
        response: { status: 429 },
      })),
    );

    await expect(
      client.search({
        page: 1,
        query: "Goblin",
        type: SearchMediaType.All,
      }),
    ).rejects.toMatchObject({
      code: "TMDB_REQUEST_FAILED",
    });
  });
});
