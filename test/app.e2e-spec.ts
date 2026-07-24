import { type Server } from "node:http";

import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { jest } from "@jest/globals";
import { IsString, MaxLength } from "class-validator";
import { ObjectId } from "mongodb";
import request, { type Response } from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";
import { tmdbSearchRateLimit } from "../src/common/throttling/throttling.constants";
import { MongooseDatabaseService } from "../src/database/mongoose-database.service";
import { TmdbClient } from "../src/integrations/tmdb/tmdb.client";

class JsonEchoRequest {
  @IsString()
  @MaxLength(100)
  message!: string;
}

@Controller("test")
class TestController {
  @Post("json")
  @AllowAnonymous()
  echoJson(@Body() body: JsonEchoRequest): JsonEchoRequest {
    return body;
  }

  @Get("protected")
  getProtected(): { status: "authenticated" } {
    return { status: "authenticated" };
  }
}

describe("application (e2e)", () => {
  let app: INestApplication;
  let server: Server;
  let databaseService: MongooseDatabaseService;
  let authenticatedCookie: string;
  let rateLimitedCookie: string;
  let otherUserCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      imports: [AppModule],
    })
      .overrideProvider(TmdbClient)
      .useValue({
        search: jest.fn<TmdbClient["search"]>().mockResolvedValue({
          page: 1,
          total_pages: 1,
          total_results: 2,
          results: [
            {
              id: 1,
              name: "Goblin",
              original_name: "도깨비",
              origin_country: ["KR"],
              genre_ids: [18],
              poster_path: "/goblin.jpg",
            },
            {
              id: 2,
              name: "Another show",
              original_name: "Another show",
              origin_country: ["US"],
              genre_ids: [18],
            },
          ],
        }),
        getDetails: jest.fn<TmdbClient["getDetails"]>().mockResolvedValue({
          id: 1,
          name: "Goblin",
          original_name: "도깨비",
          origin_country: ["KR"],
          genres: [{ id: 18 }],
          number_of_episodes: 16,
          number_of_seasons: 1,
          seasons: [
            {
              id: 10,
              season_number: 1,
              name: "Season 1",
              episode_count: 16,
            },
          ],
        }),
      })
      .compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApplication(app);
    await app.init();
    server = app.getHttpServer() as Server;
    databaseService = app.get(MongooseDatabaseService);

    const { database } = await databaseService.getNativeConnection();
    assertTestDatabase(database.databaseName);
    await database.dropDatabase();

    authenticatedCookie = await registerTestUser(
      server,
      "search-test@example.com",
      "Search Test",
    );
    rateLimitedCookie = await registerTestUser(
      server,
      "rate-limit-test@example.com",
      "Rate Limit Test",
    );
    otherUserCookie = await registerTestUser(
      server,
      "other-search-test@example.com",
      "Other Search Test",
    );
  });

  afterAll(async () => {
    const { database } = await databaseService.getNativeConnection();
    assertTestDatabase(database.databaseName);
    await database.dropDatabase();
    await app.close();
  });

  it("GET /api/health remains anonymous", async () => {
    await request(server)
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
  });

  it("re-adds JSON parsing and validation for ordinary Nest routes", async () => {
    await request(server)
      .post("/api/test/json")
      .send({ message: "parsed by Nest" })
      .expect(201)
      .expect({ message: "parsed by Nest" });

    const validationResponse = await request(server)
      .post("/api/test/json")
      .send({ message: "parsed by Nest", unexpected: true })
      .expect(400);

    expect(validationResponse.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
      },
    });
  });

  it("protects ordinary routes by default", async () => {
    await request(server).get("/api/test/protected").expect(401).expect({
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required.",
      },
    });
  });

  it("searches TMDB through the protected normalized API", async () => {
    const response = await request(server)
      .get("/api/search")
      .query({
        q: "Goblin",
        type: "tv",
        country: "kr",
      })
      .set("Cookie", authenticatedCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      page: 1,
      results: [
        {
          id: "tv:1",
          title: "Goblin",
          originalTitle: "도깨비",
          originCountry: ["KR"],
          posterPath: "/goblin.jpg",
        },
      ],
    });
  });

  it("returns normalized TMDB media details", async () => {
    const response = await request(server)
      .get("/api/media/tv/1")
      .set("Cookie", authenticatedCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: "tv:1",
      title: "Goblin",
      totalEpisodes: 16,
      totalSeasons: 1,
      seasons: [
        {
          tmdbSeasonId: 10,
          seasonNumber: 1,
          episodeCount: 16,
        },
      ],
    });
  });

  it("shares one media snapshot while isolating each user's library entry", async () => {
    const firstAdd = await request(server)
      .post("/api/library")
      .set("Cookie", authenticatedCookie)
      .send({
        mediaType: "tv",
        tmdbId: 1,
        status: "to_watch",
      })
      .expect(201);

    const secondAdd = await request(server)
      .post("/api/library")
      .set("Cookie", otherUserCookie)
      .send({
        mediaType: "tv",
        tmdbId: 1,
        status: "watching",
      })
      .expect(201);
    const firstEntry = readLibraryEntry(firstAdd.body as unknown);
    const secondEntry = readLibraryEntry(secondAdd.body as unknown);

    expect(firstAdd.body).toMatchObject({
      status: "to_watch",
      media: {
        id: "tv:1",
        title: "Goblin",
      },
    });
    expect(secondAdd.body).toMatchObject({
      status: "watching",
      mediaId: firstEntry.mediaId,
    });
    expect(secondEntry.id).not.toBe(firstEntry.id);

    const { database } = await databaseService.getNativeConnection();
    expect(await database.collection("media").countDocuments()).toBe(1);
    expect(
      await database.collection("userMedia").countDocuments(),
    ).toBe(2);

    await request(server)
      .post("/api/library")
      .set("Cookie", authenticatedCookie)
      .send({
        mediaType: "tv",
        tmdbId: 1,
        status: "watched",
      })
      .expect(409)
      .expect({
        error: {
          code: "MEDIA_ALREADY_IN_LIBRARY",
          message: "This title is already in your library.",
        },
      });

    const comfortCategory = readCategory(
      (
        await request(server)
          .post("/api/categories")
          .set("Cookie", authenticatedCookie)
          .send({
            name: "Comfort drama",
            icon: "heart",
          })
          .expect(201)
      ).body as unknown,
    );
    const thrillerCategory = readCategory(
      (
        await request(server)
          .post("/api/categories")
          .set("Cookie", authenticatedCookie)
          .send({ name: "Korean thriller" })
          .expect(201)
      ).body as unknown,
    );

    await request(server)
      .post("/api/categories")
      .set("Cookie", authenticatedCookie)
      .send({ name: "Comfort drama" })
      .expect(409)
      .expect({
        error: {
          code: "CATEGORY_ALREADY_EXISTS",
          message: "A category with this name already exists.",
        },
      });

    await request(server)
      .patch(`/api/categories/${comfortCategory.id}`)
      .set("Cookie", otherUserCookie)
      .send({ name: "Not mine" })
      .expect(404);

    await request(server)
      .patch(`/api/categories/${comfortCategory.id}`)
      .set("Cookie", authenticatedCookie)
      .send({
        name: "Comfort dramas",
        icon: "sparkles",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: comfortCategory.id,
          name: "Comfort dramas",
          slug: "comfort-dramas",
          icon: "sparkles",
        });
      });

    await request(server)
      .patch(`/api/library/${secondEntry.id}`)
      .set("Cookie", otherUserCookie)
      .send({ categoryIds: [comfortCategory.id] })
      .expect(400);

    await request(server)
      .patch(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .send({
        categoryIds: [
          comfortCategory.id,
          thrillerCategory.id,
        ],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          categoryIds: [
            comfortCategory.id,
            thrillerCategory.id,
          ],
        });
      });

    await request(server)
      .get("/api/categories")
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({
            id: comfortCategory.id,
            name: "Comfort dramas",
          }),
          expect.objectContaining({
            id: thrillerCategory.id,
            name: "Korean thriller",
          }),
        ]);
      });

    await request(server)
      .delete(`/api/categories/${thrillerCategory.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          categoryIds: [comfortCategory.id],
        });
      });

    const filteredLibrary = await request(server)
      .get("/api/library")
      .query({ status: "to_watch" })
      .set("Cookie", authenticatedCookie)
      .expect(200);

    expect(filteredLibrary.body).toEqual([
      expect.objectContaining({
        id: firstEntry.id,
        mediaId: firstEntry.mediaId,
        status: "to_watch",
      }),
    ]);

    await database.collection("userMedia").updateOne(
      { _id: new ObjectId(firstEntry.id) },
      {
        $set: {
          priorityLaneId: new ObjectId(),
          priorityPosition: 1,
        },
      },
    );

    await request(server)
      .patch(`/api/library/${secondEntry.id}/status`)
      .set("Cookie", authenticatedCookie)
      .send({ status: "watched" })
      .expect(404);

    const updatedLibraryEntry = await request(server)
      .patch(`/api/library/${firstEntry.id}/status`)
      .set("Cookie", authenticatedCookie)
      .send({ status: "watched" })
      .expect(200);

    expect(updatedLibraryEntry.body).toMatchObject({
      id: firstEntry.id,
      status: "watched",
    });
    const storedUpdatedEntry = await database
      .collection("userMedia")
      .findOne({ _id: new ObjectId(firstEntry.id) });

    expect(storedUpdatedEntry).not.toHaveProperty("priorityLaneId");
    expect(storedUpdatedEntry).not.toHaveProperty("priorityPosition");

    await request(server)
      .patch(`/api/library/${firstEntry.id}/progress`)
      .set("Cookie", authenticatedCookie)
      .send({
        currentSeason: 1,
        currentEpisode: 1,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: "watching",
          progress: {
            currentSeason: 1,
            currentEpisode: 1,
            completedEpisodes: 1,
            totalEpisodesSnapshot: 16,
            completedSeasonNumbers: [],
            includeSpecials: false,
          },
        });
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}/rating`)
      .set("Cookie", authenticatedCookie)
      .send({ rating: 8.3 })
      .expect(400);

    await request(server)
      .patch(`/api/library/${firstEntry.id}/rating`)
      .set("Cookie", authenticatedCookie)
      .send({ rating: 8.5 })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ rating: 8.5 });
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .send({
        description: "A private personal note.",
        categoryIds: [comfortCategory.id],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          description: "A private personal note.",
          categoryIds: [comfortCategory.id],
        });
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}/playback-preference`)
      .set("Cookie", authenticatedCookie)
      .send({
        audio: {
          type: "original",
          languageCode: "ko",
        },
        subtitleLanguageCode: "en",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          playbackPreference: {
            audio: {
              type: "original",
              languageCode: "ko",
            },
            subtitleLanguageCode: "en",
          },
        });
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}/progress`)
      .set("Cookie", authenticatedCookie)
      .send({
        currentSeason: 1,
        currentEpisode: 16,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: "watched",
          rating: 8.5,
          description: "A private personal note.",
          progress: {
            completedEpisodes: 16,
            completedSeasonNumbers: [1],
          },
        });
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}/rating`)
      .set("Cookie", authenticatedCookie)
      .send({ rating: null })
      .expect(200)
      .expect((response) => {
        expect(response.body).not.toHaveProperty("rating");
      });

    await request(server)
      .delete(`/api/categories/${comfortCategory.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ categoryIds: [] });
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ description: null })
      .expect(200)
      .expect((response) => {
        expect(response.body).not.toHaveProperty("description");
      });

    await request(server)
      .patch(`/api/library/${firstEntry.id}/playback-preference`)
      .set("Cookie", authenticatedCookie)
      .send({
        audio: null,
        subtitleLanguageCode: null,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).not.toHaveProperty(
          "playbackPreference",
        );
      });

    await request(server)
      .delete(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get("/api/library")
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect([]);

    expect(await database.collection("media").countDocuments()).toBe(1);
    expect(
      await database.collection("userMedia").countDocuments(),
    ).toBe(1);
  });

  it("validates search queries and media identities", async () => {
    await request(server)
      .get("/api/search")
      .set("Cookie", authenticatedCookie)
      .expect(400);

    await request(server)
      .get("/api/media/person/1")
      .set("Cookie", authenticatedCookie)
      .expect(400);
  });

  it("rate-limits TMDB search per authenticated user", async () => {
    for (let requestNumber = 0;
      requestNumber < tmdbSearchRateLimit.limit;
      requestNumber += 1) {
      await request(server)
        .get("/api/search")
        .query({ q: "Goblin", type: "tv" })
        .set("Cookie", rateLimitedCookie)
        .expect(200);
    }

    await request(server)
      .get("/api/search")
      .query({ q: "Goblin", type: "tv" })
      .set("Cookie", rateLimitedCookie)
      .expect(429)
      .expect({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests.",
        },
      });

    await request(server)
      .get("/api/search")
      .query({ q: "Goblin", type: "tv" })
      .set("Cookie", otherUserCookie)
      .expect(200);
  });

  it("registers, persists a session, completes onboarding, and logs out", async () => {
    const email = `integration-${Date.now()}@example.com`;
    const password = "correct-horse-battery-staple";
    const signUpResponse = await request(server)
      .post("/api/auth/sign-up/email")
      .set("Origin", "http://localhost:4200")
      .send({
        email,
        name: "Integration User",
        password,
      })
      .expect(200);
    const cookie = readCookie(signUpResponse);

    expect(cookie).toMatch(/^__session=/);
    expect(signUpResponse.body).toMatchObject({
      user: {
        email,
        name: "Integration User",
      },
    });

    await request(server)
      .get("/api/test/protected")
      .set("Cookie", cookie)
      .expect(200)
      .expect({ status: "authenticated" });

    await request(server)
      .post("/api/auth/update-user")
      .set("Cookie", cookie)
      .set("Origin", "http://localhost:4200")
      .send({ username: "integration_user" })
      .expect(200);

    const sessionResponse = await request(server)
      .get("/api/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);

    expect(sessionResponse.body).toMatchObject({
      user: {
        email,
        username: "integration_user",
      },
    });

    await request(server)
      .post("/api/auth/sign-out")
      .set("Cookie", cookie)
      .set("Origin", "http://localhost:4200")
      .expect(200);

    await request(server)
      .get("/api/test/protected")
      .set("Cookie", cookie)
      .expect(401);
  });

  it("returns the standard error shape for an unknown route", async () => {
    await request(server).get("/api/missing").expect(404).expect({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found.",
      },
    });
  });
});

function assertTestDatabase(databaseName: string): void {
  if (databaseName !== "drama_watch_test") {
    throw new Error(`Refusing to clear non-test database: ${databaseName}`);
  }
}

function readCookie(response: Response): string {
  const setCookie: unknown = response.headers["set-cookie"];
  const cookies: string[] = Array.isArray(setCookie)
    ? setCookie.filter(
        (cookie: unknown): cookie is string => typeof cookie === "string",
      )
    : typeof setCookie === "string"
      ? [setCookie]
      : [];

  if (cookies.length === 0) {
    throw new Error("Authentication response did not set a session cookie");
  }

  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

async function registerTestUser(
  server: Server,
  email: string,
  name: string,
): Promise<string> {
  const response = await request(server)
    .post("/api/auth/sign-up/email")
    .set("Origin", "http://localhost:4200")
    .send({
      email,
      name,
      password: "correct-horse-battery-staple",
    })
    .expect(200);

  return readCookie(response);
}

function readLibraryEntry(value: unknown): {
  id: string;
  mediaId: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("mediaId" in value) ||
    typeof value.mediaId !== "string"
  ) {
    throw new Error("Library response did not contain entry identifiers");
  }

  return {
    id: value.id,
    mediaId: value.mediaId,
  };
}

function readCategory(value: unknown): {
  id: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("Category response did not contain an identifier");
  }

  return { id: value.id };
}
