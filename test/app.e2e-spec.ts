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
