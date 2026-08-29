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
import { MediaType } from "../src/common/types/media.types";
import { MongooseDatabaseService } from "../src/database/mongoose-database.service";
import {
  type AuthenticationEmailInput,
  TransactionalEmailService,
} from "../src/integrations/email/transactional-email.service";
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

class CapturingTransactionalEmailService extends TransactionalEmailService {
  readonly verificationUrls = new Map<string, string>();
  readonly passwordResetUrls = new Map<string, string>();

  sendEmailVerification(
    input: AuthenticationEmailInput,
  ): Promise<void> {
    this.verificationUrls.set(input.recipientEmail, input.actionUrl);
    return Promise.resolve();
  }

  sendPasswordReset(input: AuthenticationEmailInput): Promise<void> {
    this.passwordResetUrls.set(input.recipientEmail, input.actionUrl);
    return Promise.resolve();
  }
}

describe("application (e2e)", () => {
  let app: INestApplication;
  let server: Server;
  let databaseService: MongooseDatabaseService;
  let authenticatedCookie: string;
  let rateLimitedCookie: string;
  let otherUserCookie: string;
  let otherUserId: string;
  let emailService: CapturingTransactionalEmailService;
  let tmdbDiscover: jest.MockedFunction<TmdbClient["discover"]>;

  beforeAll(async () => {
    emailService = new CapturingTransactionalEmailService();
    tmdbDiscover = jest
      .fn<TmdbClient["discover"]>()
      .mockImplementation((input) =>
        Promise.resolve({
          page: 1,
          total_pages: 1,
          total_results: 1,
          results: [
            input.mediaType === MediaType.Tv
              ? {
                  id: 10,
                  name: "Cached K-drama",
                  original_name: "Cached K-drama",
                  origin_country: ["KR"],
                  genre_ids: [18],
                  backdrop_path: "/cached-kdrama.jpg",
                  vote_average: 8.4,
                  vote_count: 850,
                }
              : {
                  id: 20,
                  title: "Cached movie",
                  original_title: "Cached movie",
                  genre_ids: [18],
                  backdrop_path: "/cached-movie.jpg",
                  vote_average: 8.1,
                  vote_count: 1_200,
                },
          ],
        }),
      );
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
        getDetails: jest
          .fn<TmdbClient["getDetails"]>()
          .mockImplementation((_mediaType, tmdbId) =>
            Promise.resolve(
              tmdbId === 2
                ? {
                    id: 2,
                    name: "Another show",
                    original_name: "Another show",
                    origin_country: ["US"],
                    genres: [{ id: 18 }],
                    first_air_date: "2020-01-15",
                    number_of_episodes: 10,
                    number_of_seasons: 1,
                    seasons: [
                      {
                        id: 20,
                        season_number: 1,
                        name: "Season 1",
                        episode_count: 10,
                      },
                    ],
                  }
                : {
                    id: 1,
                    name: "Goblin",
                    original_name: "도깨비",
                    origin_country: ["KR"],
                    genres: [{ id: 18 }],
                    first_air_date: "2016-12-02",
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
                  },
            ),
          ),
        discover: tmdbDiscover,
      })
      .overrideProvider(TransactionalEmailService)
      .useValue(emailService)
      .compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApplication(app);
    await app.init();
    server = app.getHttpServer() as Server;
    databaseService = app.get(MongooseDatabaseService);

    const { database } = await databaseService.getNativeConnection();
    assertTestDatabase(database.databaseName);
    await database.dropDatabase();
    const connection = databaseService.getConnectionInstance();
    await Promise.all(
      Object.values(connection.models).map((model) =>
        model.syncIndexes(),
      ),
    );

    authenticatedCookie = await registerTestUser(
      server,
      "search-test@example.com",
      "Search Test",
      emailService,
    );
    rateLimitedCookie = await registerTestUser(
      server,
      "rate-limit-test@example.com",
      "Rate Limit Test",
      emailService,
    );
    otherUserCookie = await registerTestUser(
      server,
      "other-search-test@example.com",
      "Other Search Test",
      emailService,
    );
    await setTestUsername(
      server,
      authenticatedCookie,
      "search_test",
    );
    await setTestUsername(
      server,
      rateLimitedCookie,
      "rate_limit_test",
    );
    await setTestUsername(
      server,
      otherUserCookie,
      "other_search_test",
    );

    const otherSessionResponse = await request(server)
      .get("/api/auth/get-session")
      .set("Cookie", otherUserCookie)
      .expect(200);
    const otherSession = readObject(
      otherSessionResponse.body as unknown,
      "Other user session",
    );
    otherUserId = readString(
      readObject(otherSession["user"], "Other user session profile")["id"],
      "Other user ID",
    );
  }, 60_000);

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

  it("publishes MCP OAuth discovery from the standard root path", async () => {
    const response = await request(server)
      .get("/.well-known/oauth-protected-resource")
      .expect(200);

    const metadata = readObject(
      response.body as unknown,
      "MCP resource metadata",
    );
    expect(metadata["resource"]).toBe(
      "http://localhost:8080/api/mcp",
    );
    expect(metadata["scopes_supported"]).toEqual(
      expect.arrayContaining([
        "mcp:library:read",
        "mcp:social:read",
        "mcp:library:write",
        "mcp:social:write",
      ]) as unknown,
    );
  });

  it("requires an audience-bound OAuth token for MCP requests", async () => {
    const response = await request(server)
      .post("/api/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2026-07-28",
          capabilities: {},
          clientInfo: { name: "e2e", version: "1.0.0" },
        },
      })
      .expect(401);

    expect(response.headers["www-authenticate"]).toContain(
      "resource_metadata=",
    );
    const errorResponse = readObject(
      response.body as unknown,
      "MCP authentication error",
    );
    expect(errorResponse["jsonrpc"]).toBe("2.0");
    expect(
      readObject(errorResponse["error"], "MCP authentication error body")[
        "code"
      ],
    ).toBe(-32_000);
  });

  it("does not expose the modern MCP transport over GET", async () => {
    await request(server).get("/api/mcp").expect(404);
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

  it("finds public profiles without exposing private auth fields", async () => {
    const profileResponse = await request(server)
      .get(`/api/users/${otherUserId}`)
      .expect(200);

    expect(profileResponse.body).toMatchObject({
      username: "other_search_test",
      displayUsername: "other_search_test",
      name: "Other Search Test",
    });
    expect(profileResponse.body).toHaveProperty("id");
    expect(profileResponse.body).toHaveProperty("joinedAt");
    expect(profileResponse.body).not.toHaveProperty("email");
    expect(profileResponse.body).not.toHaveProperty("emailVerified");

    await request(server)
      .get("/api/users/search")
      .query({ q: "other" })
      .expect(401);

    const searchResponse = await request(server)
      .get("/api/users/search")
      .query({ q: "other", limit: 5 })
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const searchResults = readObjectArray(
      searchResponse.body as unknown,
      "User search",
    );

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({
      username: "other_search_test",
      name: "Other Search Test",
    });
    expect(searchResults[0]).not.toHaveProperty("email");

    const nameSearchResponse = await request(server)
      .get("/api/users/search")
      .query({ q: "Search Test", limit: 5 })
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const nameSearchResults = readObjectArray(
      nameSearchResponse.body as unknown,
      "Name search",
    );

    expect(nameSearchResults[0]).toMatchObject({
      username: "other_search_test",
    });

    const similarSearchResponse = await request(server)
      .get("/api/users/search")
      .query({ q: "othre_search_test", limit: 5 })
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const similarSearchResults = readObjectArray(
      similarSearchResponse.body as unknown,
      "Similar user search",
    );

    expect(similarSearchResults[0]).toMatchObject({
      username: "other_search_test",
    });

    await request(server)
      .get("/api/users/search")
      .query({ q: "s" })
      .set("Cookie", authenticatedCookie)
      .expect(400);

    await request(server)
      .get("/api/users/missing_user")
      .set("Cookie", authenticatedCookie)
      .expect(404)
      .expect({
        error: {
          code: "NOT_FOUND",
          message: "User not found.",
        },
      });
  });

  it("manages friend requests without trusting client-supplied ownership", async () => {
    await request(server).get("/api/friends").expect(401);
    await request(server).get("/api/notifications").expect(401);

    const requestResponse = await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test" })
      .expect(201);
    const friendship = readObject(
      requestResponse.body as unknown,
      "Friend request",
    );
    const friendshipId = readString(
      friendship["id"],
      "Friend request ID",
    );

    expect(friendship).toMatchObject({
      status: "pending",
      direction: "outgoing",
      user: {
        username: "other_search_test",
        name: "Other Search Test",
      },
    });
    expect(friendship["user"]).not.toHaveProperty("email");

    const requestNotificationsResponse = await request(server)
      .get("/api/notifications")
      .set("Cookie", otherUserCookie)
      .expect(200);
    const requestNotifications = readObject(
      requestNotificationsResponse.body as unknown,
      "Friend request notifications",
    );
    const requestNotificationItems = readObjectArray(
      requestNotifications["items"],
      "Friend request notification items",
    );
    expect(requestNotifications["unreadCount"]).toBe(1);
    expect(requestNotificationItems[0]).toMatchObject({
      type: "friend_request",
      entityId: friendshipId,
      isRead: false,
      actor: { username: "search_test" },
    });
    const requestNotificationId = readString(
      readObject(
        requestNotificationItems[0],
        "Friend request notification",
      )["id"],
      "Friend request notification ID",
    );

    await request(server)
      .post(`/api/notifications/${requestNotificationId}/read`)
      .set("Cookie", authenticatedCookie)
      .expect(404);

    await request(server)
      .post(`/api/notifications/${requestNotificationId}/read`)
      .set("Cookie", otherUserCookie)
      .expect(204);

    await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test" })
      .expect(409)
      .expect({
        error: {
          code: "FRIENDSHIP_ALREADY_EXISTS",
          message: "A friendship or pending request already exists.",
        },
      });

    await request(server)
      .post("/api/friends/request")
      .set("Cookie", otherUserCookie)
      .send({ username: "search_test" })
      .expect(409);

    const outgoingResponse = await request(server)
      .get("/api/friends")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const outgoing = readObject(
      outgoingResponse.body as unknown,
      "Outgoing friendships",
    );
    expect(
      readObjectArray(
        outgoing["outgoingRequests"],
        "Outgoing requests",
      ),
    ).toHaveLength(1);

    const incomingResponse = await request(server)
      .get("/api/friends")
      .set("Cookie", otherUserCookie)
      .expect(200);
    const incoming = readObject(
      incomingResponse.body as unknown,
      "Incoming friendships",
    );
    expect(
      readObjectArray(
        incoming["incomingRequests"],
        "Incoming requests",
      ),
    ).toHaveLength(1);

    await request(server)
      .post(`/api/friends/${friendshipId}/accept`)
      .set("Cookie", rateLimitedCookie)
      .expect(404);

    await request(server)
      .post(`/api/friends/${friendshipId}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          status: "accepted",
          direction: "incoming",
          user: { username: "search_test" },
        });
      });

    const acceptedNotificationsResponse = await request(server)
      .get("/api/notifications")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const acceptedNotifications = readObject(
      acceptedNotificationsResponse.body as unknown,
      "Accepted friendship notifications",
    );
    expect(acceptedNotifications["unreadCount"]).toBe(1);
    expect(
      readObjectArray(
        acceptedNotifications["items"],
        "Accepted friendship notification items",
      )[0],
    ).toMatchObject({
      type: "friend_request_accepted",
      entityId: friendshipId,
      actor: { username: "other_search_test" },
    });

    await request(server)
      .post("/api/notifications/read-all")
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect({ updatedCount: 1 });

    const friendsResponse = await request(server)
      .get("/api/friends")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const friends = readObject(
      friendsResponse.body as unknown,
      "Accepted friendships",
    );
    expect(
      readObjectArray(friends["friends"], "Friends"),
    ).toHaveLength(1);

    await request(server)
      .delete(`/api/friends/${friendshipId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    const rejectedRequestResponse = await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "rate_limit_test" })
      .expect(201);
    const rejectedRequest = readObject(
      rejectedRequestResponse.body as unknown,
      "Rejected friend request",
    );
    const rejectedRequestId = readString(
      rejectedRequest["id"],
      "Rejected friend request ID",
    );

    await request(server)
      .post(`/api/friends/${rejectedRequestId}/reject`)
      .set("Cookie", rateLimitedCookie)
      .expect(204);

    const emptyFriendsResponse = await request(server)
      .get("/api/friends")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    expect(emptyFriendsResponse.body).toEqual({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    });
  });

  it("serves one shared cached K-drama discovery portal", async () => {
    tmdbDiscover.mockClear();

    const firstResponse = await request(server)
      .get("/api/discovery/home")
      .expect(200);
    const firstBody = readObject(
      firstResponse.body as unknown,
      "Discovery home",
    );
    const shelves = readObjectArray(
      firstBody["shelves"],
      "Discovery shelves",
    );

    expect(shelves).toHaveLength(5);
    expect(firstBody["featured"]).toMatchObject({
      id: "tv:10",
      title: "Cached K-drama",
    });
    expect(tmdbDiscover).toHaveBeenCalledTimes(5);

    await request(server)
      .get("/api/discovery/home")
      .expect(200);
    expect(tmdbDiscover).toHaveBeenCalledTimes(5);

    const { database } = await databaseService.getNativeConnection();
    expect(
      await database.collection("discoveryCache").countDocuments(),
    ).toBe(5);
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

  it("sends, accepts, and dismisses friend suggestions without duplicating library data", async () => {
    await request(server).get("/api/suggestions").expect(401);

    await request(server)
      .post("/api/suggestions")
      .set("Cookie", authenticatedCookie)
      .send({
        username: "other_search_test",
        mediaType: "tv",
        tmdbId: 1,
      })
      .expect(403)
      .expect({
        error: {
          code: "FRIENDSHIP_REQUIRED",
          message: "You can suggest titles only to accepted friends.",
        },
      });

    const friendRequestResponse = await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "rate_limit_test" })
      .expect(201);
    const friendRequest = readObject(
      friendRequestResponse.body as unknown,
      "Suggestion friend request",
    );
    const friendshipId = readString(
      friendRequest["id"],
      "Suggestion friendship ID",
    );

    await request(server)
      .post(`/api/friends/${friendshipId}/accept`)
      .set("Cookie", rateLimitedCookie)
      .expect(200);

    await request(server)
      .post("/api/notifications/read-all")
      .set("Cookie", rateLimitedCookie)
      .expect(200);

    const createResponse = await request(server)
      .post("/api/suggestions")
      .set("Cookie", authenticatedCookie)
      .send({
        username: "rate_limit_test",
        mediaType: "tv",
        tmdbId: 1,
        message: "You will love this one.",
      })
      .expect(201);
    const created = readObject(
      createResponse.body as unknown,
      "Created suggestion",
    );
    const suggestionId = readString(
      created["id"],
      "Suggestion ID",
    );

    expect(created).toMatchObject({
      status: "pending",
      direction: "sent",
      message: "You will love this one.",
      user: { username: "rate_limit_test" },
      media: { id: "tv:1", title: "Goblin" },
    });
    expect(created["user"]).not.toHaveProperty("email");

    const resendResponse = await request(server)
      .post("/api/suggestions")
      .set("Cookie", authenticatedCookie)
      .send({
        username: "rate_limit_test",
        mediaType: "tv",
        tmdbId: 1,
        message: "Actually, start with the character chemistry.",
      })
      .expect(201);
    expect(resendResponse.body).toMatchObject({
      id: suggestionId,
      status: "pending",
      message: "Actually, start with the character chemistry.",
    });

    const overviewResponse = await request(server)
      .get("/api/suggestions")
      .set("Cookie", rateLimitedCookie)
      .expect(200);
    const overview = readObject(
      overviewResponse.body as unknown,
      "Suggestion overview",
    );
    const receivedSuggestions = readObjectArray(
      overview["received"],
      "Received suggestions",
    );
    expect(receivedSuggestions).toHaveLength(1);
    expect(receivedSuggestions[0]).toMatchObject({
      id: suggestionId,
      message: "Actually, start with the character chemistry.",
    });

    const clearMessageResponse = await request(server)
      .post("/api/suggestions")
      .set("Cookie", authenticatedCookie)
      .send({
        username: "rate_limit_test",
        mediaType: "tv",
        tmdbId: 1,
      })
      .expect(201);
    expect(clearMessageResponse.body).toMatchObject({
      id: suggestionId,
      status: "pending",
    });
    expect(clearMessageResponse.body).not.toHaveProperty("message");

    const suggestionNotificationsResponse = await request(server)
      .get("/api/notifications")
      .set("Cookie", rateLimitedCookie)
      .expect(200);
    const suggestionNotifications = readObject(
      suggestionNotificationsResponse.body as unknown,
      "Suggestion notifications",
    );
    const unreadSuggestionNotifications = readObjectArray(
      suggestionNotifications["items"],
      "Suggestion notification items",
    ).filter((item) => {
      const notification = readObject(item, "Suggestion notification");
      return (
        notification["type"] === "suggestion_received" &&
        notification["isRead"] === false
      );
    });
    expect(suggestionNotifications["unreadCount"]).toBe(1);
    expect(unreadSuggestionNotifications).toHaveLength(1);
    expect(unreadSuggestionNotifications[0]).toMatchObject({
      type: "suggestion_received",
      entityId: suggestionId,
      actor: { username: "search_test" },
    });
    const suggestionNotificationId = readString(
      readObject(
        unreadSuggestionNotifications[0],
        "Unread suggestion notification",
      )["id"],
      "Suggestion notification ID",
    );

    await request(server)
      .post(`/api/notifications/${suggestionNotificationId}/read`)
      .set("Cookie", rateLimitedCookie)
      .expect(204);

    const readSuggestionNotifications = await request(server)
      .get("/api/notifications")
      .set("Cookie", rateLimitedCookie)
      .expect(200);
    expect(
      readObject(
        readSuggestionNotifications.body as unknown,
        "Read suggestion notifications",
      )["unreadCount"],
    ).toBe(0);

    await request(server)
      .post(`/api/suggestions/${suggestionId}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(404);

    await request(server)
      .post(`/api/suggestions/${suggestionId}/accept`)
      .set("Cookie", rateLimitedCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          status: "accepted",
          direction: "received",
          user: { username: "search_test" },
        });
      });

    const firstLibraryResponse = await request(server)
      .get("/api/library")
      .set("Cookie", rateLimitedCookie)
      .expect(200);
    const firstLibrary = readObjectArray(
      firstLibraryResponse.body as unknown,
      "Suggested library",
    );
    const suggestedEntry = readLibraryEntry(firstLibrary[0]);
    expect(firstLibrary).toHaveLength(1);
    expect(firstLibrary[0]).toMatchObject({
      status: "to_watch",
      media: { id: "tv:1" },
    });

    await request(server)
      .patch(`/api/library/${suggestedEntry.id}/status`)
      .set("Cookie", rateLimitedCookie)
      .send({ status: "watching" })
      .expect(200);

    const secondSuggestionResponse = await request(server)
      .post("/api/suggestions")
      .set("Cookie", authenticatedCookie)
      .send({
        username: "rate_limit_test",
        mediaType: "tv",
        tmdbId: 1,
      })
      .expect(201);
    const secondSuggestion = readObject(
      secondSuggestionResponse.body as unknown,
      "Second suggestion",
    );
    const secondSuggestionId = readString(
      secondSuggestion["id"],
      "Second suggestion ID",
    );

    await request(server)
      .post(`/api/suggestions/${secondSuggestionId}/accept`)
      .set("Cookie", rateLimitedCookie)
      .expect(200);

    const preservedLibraryResponse = await request(server)
      .get("/api/library")
      .set("Cookie", rateLimitedCookie)
      .expect(200);
    const preservedLibrary = readObjectArray(
      preservedLibraryResponse.body as unknown,
      "Preserved suggested library",
    );
    expect(preservedLibrary).toHaveLength(1);
    expect(preservedLibrary[0]).toMatchObject({
      id: suggestedEntry.id,
      status: "watching",
    });

    const dismissResponse = await request(server)
      .post("/api/suggestions")
      .set("Cookie", authenticatedCookie)
      .send({
        username: "rate_limit_test",
        mediaType: "tv",
        tmdbId: 1,
      })
      .expect(201);
    const dismissSuggestion = readObject(
      dismissResponse.body as unknown,
      "Dismissed suggestion",
    );
    const dismissSuggestionId = readString(
      dismissSuggestion["id"],
      "Dismissed suggestion ID",
    );

    await request(server)
      .post(`/api/suggestions/${dismissSuggestionId}/dismiss`)
      .set("Cookie", rateLimitedCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          status: "dismissed",
        });
      });

    await request(server)
      .delete(`/api/library/${suggestedEntry.id}`)
      .set("Cookie", rateLimitedCookie)
      .expect(204);

    await request(server)
      .delete(`/api/friends/${friendshipId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);
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

    const priorityResponse = await request(server)
      .get("/api/priority-lanes")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const priorityLanes = readPriorityLanes(
      priorityResponse.body as unknown,
    );
    expect(priorityResponse.body).toEqual([
      expect.objectContaining({ name: "Must watch", position: 0 }),
      expect.objectContaining({
        name: "I really want to watch",
        position: 1,
      }),
      expect.objectContaining({ name: "Maybe", position: 2 }),
      expect.objectContaining({
        name: "If there is nothing else",
        position: 3,
      }),
    ]);

    const reversedLaneIds = priorityLanes
      .map((lane) => lane.id)
      .reverse();
    const expectedReorderedLanes = reversedLaneIds.map((id, position) => ({
      id,
      position,
    }));
    await request(server)
      .post("/api/priority-lanes/reorder")
      .set("Cookie", authenticatedCookie)
      .send({ laneIds: reversedLaneIds })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject(expectedReorderedLanes);
      });

    const customLane = readPriorityLane(
      (
        await request(server)
          .post("/api/priority-lanes")
          .set("Cookie", authenticatedCookie)
          .send({ name: "Watch tonight" })
          .expect(201)
      ).body as unknown,
    );

    await request(server)
      .patch(`/api/priority-lanes/${customLane.id}`)
      .set("Cookie", otherUserCookie)
      .send({ name: "Not mine" })
      .expect(404);

    await request(server)
      .patch(`/api/priority-lanes/${customLane.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ name: "Tonight shortlist" })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: customLane.id,
          name: "Tonight shortlist",
          isDefault: false,
        });
      });

    await request(server)
      .post("/api/priority-lanes/reorder-items")
      .set("Cookie", authenticatedCookie)
      .send({
        lanes: [
          {
            laneId: customLane.id,
            itemIds: [firstEntry.id],
          },
        ],
      })
      .expect(204);

    await request(server)
      .get(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          priorityLaneId: customLane.id,
          priorityPosition: 0,
        });
      });

    const destinationLane = priorityLanes[0];

    if (!destinationLane) {
      throw new Error("Authenticated user did not receive default lanes");
    }

    await request(server)
      .post("/api/priority-lanes/reorder-items")
      .set("Cookie", authenticatedCookie)
      .send({
        lanes: [
          { laneId: customLane.id, itemIds: [] },
          {
            laneId: destinationLane.id,
            itemIds: [firstEntry.id],
          },
        ],
      })
      .expect(204);

    await request(server)
      .get(`/api/library/${firstEntry.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          priorityLaneId: destinationLane.id,
          priorityPosition: 0,
        });
      });

    const otherPriorityLanes = readPriorityLanes(
      (
        await request(server)
          .get("/api/priority-lanes")
          .set("Cookie", otherUserCookie)
          .expect(200)
      ).body as unknown,
    );
    const otherLane = otherPriorityLanes[0];

    if (!otherLane) {
      throw new Error("Other user did not receive default lanes");
    }

    await request(server)
      .post("/api/priority-lanes/reorder-items")
      .set("Cookie", otherUserCookie)
      .send({
        lanes: [
          {
            laneId: otherLane.id,
            itemIds: [firstEntry.id],
          },
        ],
      })
      .expect(400);

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
      .delete(`/api/priority-lanes/${customLane.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

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

    await request(server).get("/api/statistics").expect(401);
    await request(server)
      .get("/api/statistics")
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        const statistics = readObject(
          response.body as unknown,
          "Personal statistics",
        );
        const completedByMonth = readObjectArray(
          statistics["completedByMonth"],
          "Statistics completion months",
        );
        expect(response.body).toMatchObject({
          totals: {
            library: 1,
            toWatch: 0,
            watching: 0,
            watched: 1,
            movies: 0,
            tv: 1,
            rated: 0,
            completedEpisodes: 16,
          },
          ratingDistribution: [],
          topGenres: [{ genreId: 18, count: 1 }],
          topCountries: [{ countryCode: "KR", count: 1 }],
        });
        expect(completedByMonth).toHaveLength(12);
        expect(completedByMonth).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ count: 1 }),
          ]),
        );
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

  it("shares safe media context only with accepted friends", async () => {
    await request(server)
      .get("/api/media/tv/1/friend-context")
      .expect(401);

    const otherLibraryResponse = await request(server)
      .get("/api/library")
      .set("Cookie", otherUserCookie)
      .expect(200);
    const [otherEntryValue] = readObjectArray(
      otherLibraryResponse.body as unknown,
      "Other user library",
    );
    const otherEntry = readLibraryEntry(otherEntryValue);

    await request(server)
      .patch(`/api/library/${otherEntry.id}/rating`)
      .set("Cookie", otherUserCookie)
      .send({ rating: 8.5 })
      .expect(200);

    await request(server)
      .patch(`/api/library/${otherEntry.id}`)
      .set("Cookie", otherUserCookie)
      .send({ description: "Private friend notes" })
      .expect(200);

    await request(server)
      .get("/api/media/tv/1/friend-context")
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect({ friends: [] });

    const friendRequestResponse = await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test" })
      .expect(201);
    const friendshipId = readString(
      readObject(
        friendRequestResponse.body as unknown,
        "Friend context request",
      )["id"],
      "Friend context request ID",
    );

    await request(server)
      .post(`/api/friends/${friendshipId}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(200);

    const contextResponse = await request(server)
      .get("/api/media/tv/1/friend-context")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const context = readObject(
      contextResponse.body as unknown,
      "Media friend context",
    );
    const activities = readObjectArray(
      context["friends"],
      "Media friend activities",
    );

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      user: {
        username: "other_search_test",
        name: "Other Search Test",
      },
      status: "watching",
      rating: 8.5,
    });
    expect(activities[0]).not.toHaveProperty("description");
    expect(activities[0]).not.toHaveProperty("progress");
    expect(activities[0]).not.toHaveProperty("categoryIds");
    expect(activities[0]).not.toHaveProperty(
      "playbackPreference",
    );

    await request(server)
      .get("/api/media/tv/1/friend-context")
      .set("Cookie", rateLimitedCookie)
      .expect(200)
      .expect({ friends: [] });

    await request(server)
      .delete(`/api/friends/${friendshipId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);
  });

  it("manages settings and enforces public library visibility", async () => {
    await request(server).get("/api/settings").expect(401);
    await request(server)
      .patch("/api/settings")
      .send({ libraryVisibility: "public" })
      .expect(401);

    await request(server)
      .get("/api/settings")
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect({
        libraryVisibility: "private",
        activityVisibility: "private",
      });

    const friendRequestResponse = await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test" })
      .expect(201);
    const friendshipId = readString(
      readObject(
        friendRequestResponse.body as unknown,
        "Public library friend request",
      )["id"],
      "Public library friendship ID",
    );

    await request(server)
      .post(`/api/friends/${friendshipId}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(200);

    const currentLibraryResponse = await request(server)
      .get("/api/library")
      .set("Cookie", otherUserCookie)
      .expect(200);
    const existingFirstEntry = readObjectArray(
      currentLibraryResponse.body as unknown,
      "Visibility test owner library",
    ).find((entry) => {
      const media = readObject(
        readObject(entry, "Visibility test library entry")["media"],
        "Visibility test library media",
      );
      return media["id"] === "tv:1";
    });
    const firstLibraryEntry =
      existingFirstEntry === undefined
        ? readLibraryEntry(
            (
              await request(server)
                .post("/api/library")
                .set("Cookie", otherUserCookie)
                .send({
                  mediaType: "tv",
                  tmdbId: 1,
                  status: "watching",
                })
                .expect(201)
            ).body as unknown,
          )
        : readLibraryEntry(existingFirstEntry);
    await request(server)
      .patch(`/api/library/${firstLibraryEntry.id}/rating`)
      .set("Cookie", otherUserCookie)
      .send({ rating: 8.5 })
      .expect(200);

    const secondLibraryEntry = readLibraryEntry(
      (
        await request(server)
          .post("/api/library")
          .set("Cookie", otherUserCookie)
          .send({
            mediaType: "tv",
            tmdbId: 2,
            status: "watched",
          })
          .expect(201)
      ).body as unknown,
    );
    await request(server)
      .patch(`/api/library/${secondLibraryEntry.id}/rating`)
      .set("Cookie", otherUserCookie)
      .send({ rating: 6 })
      .expect(200);

    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .set("Cookie", authenticatedCookie)
      .expect(403)
      .expect({
        error: {
          code: "LIBRARY_NOT_VISIBLE",
          message: "This library is not available to you.",
        },
      });

    await request(server)
      .patch("/api/settings")
      .set("Cookie", otherUserCookie)
      .send({ libraryVisibility: "friends" })
      .expect(200)
      .expect({
        libraryVisibility: "friends",
        activityVisibility: "private",
      });

    const friendLibraryResponse = await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .query({
        status: "watching",
        mediaType: "tv",
        minRating: 8,
        genreId: 18,
        country: "kr",
        yearFrom: 1900,
        yearTo: 2100,
        sort: "title_asc",
        page: 1,
        limit: 12,
      })
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const friendLibrary = readObject(
      friendLibraryResponse.body as unknown,
      "Friend library",
    );
    const friendLibraryItems = readObjectArray(
      friendLibrary["items"],
      "Friend library items",
    );

    expect(friendLibrary).toMatchObject({
      user: { username: "other_search_test" },
      visibility: "friends",
      isOwner: false,
      page: 1,
      totalPages: 1,
      totalResults: 1,
    });
    expect(friendLibraryItems[0]).toMatchObject({
      status: "watching",
      rating: 8.5,
      media: {
        id: "tv:1",
        title: "Goblin",
      },
    });
    expect(friendLibraryItems[0]).not.toHaveProperty("id");
    expect(friendLibraryItems[0]).not.toHaveProperty("description");
    expect(friendLibraryItems[0]).not.toHaveProperty("progress");
    expect(friendLibraryItems[0]).not.toHaveProperty("categoryIds");
    expect(friendLibraryItems[0]).not.toHaveProperty(
      "playbackPreference",
    );

    const sortedLibraryResponse = await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .query({ sort: "title_asc" })
      .set("Cookie", authenticatedCookie)
      .expect(200);
    const sortedItems = readObjectArray(
      readObject(
        sortedLibraryResponse.body as unknown,
        "Sorted friend library",
      )["items"],
      "Sorted friend library items",
    );
    expect(
      sortedItems.map((item) => {
        const media = readObject(
          readObject(item, "Sorted friend library item")["media"],
          "Sorted friend library media",
        );
        return readString(
          media["title"],
          "Sorted friend library title",
        );
      }),
    ).toEqual(["Another show", "Goblin"]);

    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .query({ yearFrom: 2017, yearTo: 2020 })
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          totalResults: 1,
          totalPages: 1,
          items: [{ media: { title: "Another show" } }],
        });
      });

    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .query({ yearFrom: 2025, yearTo: 2020 })
      .set("Cookie", authenticatedCookie)
      .expect(400)
      .expect({
        error: {
          code: "INVALID_YEAR_RANGE",
          message:
            "The starting year cannot be after the ending year.",
        },
      });

    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .expect(403);
    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .set("Cookie", rateLimitedCookie)
      .expect(403);

    await request(server)
      .patch("/api/settings")
      .set("Cookie", otherUserCookie)
      .send({ libraryVisibility: "public" })
      .expect(200);

    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          visibility: "public",
          isOwner: false,
          totalResults: 2,
        });
      });

    await request(server)
      .patch("/api/settings")
      .set("Cookie", otherUserCookie)
      .send({ libraryVisibility: "private" })
      .expect(200);

    await request(server)
      .get(`/api/users/${otherUserId}/library`)
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          visibility: "private",
          isOwner: true,
        });
      });

    await request(server)
      .patch("/api/settings")
      .set("Cookie", otherUserCookie)
      .send({ libraryVisibility: "everyone" })
      .expect(400);

    await request(server)
      .delete(`/api/library/${secondLibraryEntry.id}`)
      .set("Cookie", otherUserCookie)
      .expect(204);

    await request(server)
      .delete(`/api/library/${firstLibraryEntry.id}`)
      .set("Cookie", otherUserCookie)
      .expect(204);

    await request(server)
      .delete(`/api/friends/${friendshipId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);
  });

  it("shares a private wheel with role-based access and spin history", async () => {
    const libraryEntry = readLibraryEntry(
      (
        await request(server)
          .post("/api/library")
          .set("Cookie", authenticatedCookie)
          .send({
            mediaType: "tv",
            tmdbId: 1,
            status: "to_watch",
          })
          .expect(201)
      ).body as unknown,
    );
    const wheel = readWheel(
      (
        await request(server)
          .post("/api/wheels")
          .set("Cookie", authenticatedCookie)
          .send({
            title: "Friday night",
            description: "Pick our next drama.",
            selectionMode: "fully_random",
          })
          .expect(201)
      ).body as unknown,
    );

    await request(server)
      .get(`/api/wheels/${wheel.id}`)
      .set("Cookie", otherUserCookie)
      .expect(404);

    await request(server)
      .post(`/api/wheels/${wheel.id}/members`)
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test", role: "viewer" })
      .expect(400)
      .expect({
        error: {
          code: "WHEEL_MEMBER_MUST_BE_FRIEND",
          message: "You can share a wheel only with an accepted friend.",
        },
      });

    const friendshipResponse = await request(server)
      .post("/api/friends/request")
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test" })
      .expect(201);
    const friendshipId = readString(
      readObject(
        friendshipResponse.body as unknown,
        "Wheel friendship",
      )["id"],
      "Wheel friendship ID",
    );

    await request(server)
      .post(`/api/friends/${friendshipId}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(200);

    const memberResponse = await request(server)
      .post(`/api/wheels/${wheel.id}/members`)
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test", role: "viewer" })
      .expect(201);
    const member = readObject(
      memberResponse.body as unknown,
      "Wheel member",
    );
    const memberUserId = readString(
      readObject(member["user"], "Wheel member user")["id"],
      "Wheel member user ID",
    );
    expect(member).toMatchObject({
      role: "viewer",
      user: { username: "other_search_test" },
    });

    await request(server)
      .post(`/api/wheels/${wheel.id}/members`)
      .set("Cookie", authenticatedCookie)
      .send({ username: "other_search_test", role: "editor" })
      .expect(409)
      .expect({
        error: {
          code: "WHEEL_MEMBER_ALREADY_EXISTS",
          message: "This friend is already a wheel member.",
        },
      });

    await request(server)
      .get(`/api/wheels/${wheel.id}`)
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: wheel.id,
          role: "viewer",
          members: [
            {
              role: "owner",
              user: { username: "search_test" },
            },
            {
              role: "viewer",
              user: { username: "other_search_test" },
            },
          ],
        });
      });

    await request(server)
      .get("/api/wheels")
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: wheel.id,
              role: "viewer",
            }),
          ]),
        );
      });

    const notificationResponse = await request(server)
      .get("/api/notifications")
      .set("Cookie", otherUserCookie)
      .expect(200);
    const notificationItems = readObjectArray(
      readObject(
        notificationResponse.body as unknown,
        "Wheel notifications",
      )["items"],
      "Wheel notification items",
    );
    const wheelNotification = notificationItems.find(
      (item) =>
        readObject(item, "Wheel notification")["type"] ===
        "wheel_invite",
    );
    expect(wheelNotification).toMatchObject({
      type: "wheel_invite",
      entityId: wheel.id,
      actor: { username: "search_test" },
    });

    await request(server)
      .post(`/api/wheels/${wheel.id}/items`)
      .set("Cookie", otherUserCookie)
      .send({ mediaId: libraryEntry.mediaId })
      .expect(403);

    const wheelItem = readWheelItem(
      (
        await request(server)
          .post(`/api/wheels/${wheel.id}/items`)
          .set("Cookie", authenticatedCookie)
          .send({
            mediaId: libraryEntry.mediaId,
            weight: 3,
          })
          .expect(201)
      ).body as unknown,
    );

    await request(server)
      .post(`/api/wheels/${wheel.id}/items`)
      .set("Cookie", authenticatedCookie)
      .send({ mediaId: libraryEntry.mediaId })
      .expect(409)
      .expect({
        error: {
          code: "WHEEL_ITEM_ALREADY_EXISTS",
          message: "This title is already on the wheel.",
        },
      });

    await request(server)
      .patch(`/api/wheels/${wheel.id}/items/${wheelItem.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ weight: 5, isEnabled: false })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: wheelItem.id,
          weight: 5,
          isEnabled: false,
        });
      });

    await request(server)
      .post(`/api/wheels/${wheel.id}/spin`)
      .set("Cookie", otherUserCookie)
      .expect(403);

    await request(server)
      .post(`/api/wheels/${wheel.id}/spin`)
      .set("Cookie", authenticatedCookie)
      .expect(400)
      .expect({
        error: {
          code: "WHEEL_HAS_NO_ENABLED_ITEMS",
          message: "Enable at least one wheel item before spinning.",
        },
      });

    await request(server)
      .patch(`/api/wheels/${wheel.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ selectionMode: "avoid_recent_winners" })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: wheel.id,
          selectionMode: "avoid_recent_winners",
          itemCount: 1,
          enabledItemCount: 0,
        });
      });

    await request(server)
      .patch(`/api/wheels/${wheel.id}/items/${wheelItem.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ isEnabled: true })
      .expect(200);

    await request(server)
      .patch(`/api/wheels/${wheel.id}/members/${memberUserId}`)
      .set("Cookie", authenticatedCookie)
      .send({ role: "editor" })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          role: "editor",
          user: { id: memberUserId },
        });
      });

    await request(server)
      .patch(`/api/wheels/${wheel.id}`)
      .set("Cookie", otherUserCookie)
      .send({ title: "Editors cannot rename" })
      .expect(403);

    await request(server)
      .post(`/api/wheels/${wheel.id}/reorder`)
      .set("Cookie", otherUserCookie)
      .send({ itemIds: [wheelItem.id] })
      .expect(201);

    const spinResponse = await request(server)
          .post(`/api/wheels/${wheel.id}/spin`)
          .set("Cookie", otherUserCookie)
          .expect(201)
          .expect((response) => {
            expect(response.body).toMatchObject({
              spunBy: {
                id: memberUserId,
                username: "other_search_test",
              },
            });
          });
    const spin = readWheelSpin(
      spinResponse.body as unknown,
    );
    expect(spin.wheelItemId).toBe(wheelItem.id);

    await request(server)
      .get(`/api/wheels/${wheel.id}/history`)
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject([
          {
            spinId: spin.spinId,
            selectedItem: {
              wheelItemId: wheelItem.id,
              title: "Goblin",
            },
            spunBy: {
              id: memberUserId,
              username: "other_search_test",
            },
          },
        ]);
      });

    const unlistedWheel = readObject(
      (
        await request(server)
          .patch(`/api/wheels/${wheel.id}`)
          .set("Cookie", authenticatedCookie)
          .send({ visibility: "unlisted" })
          .expect(200)
      ).body as unknown,
      "Unlisted wheel",
    );
    const publicSlug = readString(
      unlistedWheel["publicSlug"],
      "Wheel public slug",
    );
    expect(publicSlug).toHaveLength(16);

    await request(server)
      .get(`/api/public/wheels/${publicSlug}`)
      .expect(200)
      .expect((response: Response) => {
        const publicWheel = readObject(
          response.body as unknown,
          "Public wheel response",
        );
        expect(publicWheel).toMatchObject({
          title: "Friday night",
          visibility: "unlisted",
          publicSlug,
          itemCount: 1,
          enabledItemCount: 1,
        });
        expect(publicWheel).not.toHaveProperty("id");
        const publicItems = readObjectArray(
          publicWheel["items"],
          "Public wheel items",
        );
        expect(publicItems).toHaveLength(1);
        expect(publicItems[0]).not.toHaveProperty("id");
        expect(publicItems[0]).not.toHaveProperty("mediaId");
        expect(
          readObject(publicItems[0]?.["media"], "Public wheel media"),
        ).not.toHaveProperty("id");
        const publicHistory = readObjectArray(
          publicWheel["history"],
          "Public wheel history",
        );
        expect(publicHistory).toHaveLength(1);
        expect(publicHistory[0]).not.toHaveProperty("spinId");
        const selectedItem = readObject(
          publicHistory[0]?.["selectedItem"],
          "Public wheel selected item",
        );
        expect(selectedItem).not.toHaveProperty("wheelItemId");
        expect(selectedItem).not.toHaveProperty("mediaId");
        expect(JSON.stringify(publicWheel)).not.toContain("@example.com");
      });

    await request(server)
      .get(`/api/public/wheels/share/${publicSlug}`)
      .expect("Content-Type", /text\/html/)
      .expect("Cache-Control", "no-store")
      .expect(200)
      .expect((response: Response) => {
        expect(response.text).toContain(
          '<meta name="robots" content="noindex, nofollow">',
        );
        expect(response.text).toContain(
          `/wheels/public/${publicSlug}`,
        );
        expect(response.text).not.toContain("@example.com");
      });

    await request(server)
      .get("/api/public/seo/sitemap.xml")
      .expect("Content-Type", /application\/xml/)
      .expect(200)
      .expect((response: Response) => {
        expect(response.text).not.toContain(`/wheels/public/${publicSlug}`);
      });

    await request(server)
      .patch(`/api/wheels/${wheel.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ visibility: "public" })
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          visibility: "public",
          publicSlug,
        });
      });

    await request(server)
      .get("/api/public/seo/sitemap.xml")
      .expect(200)
      .expect((response: Response) => {
        expect(response.text).toContain(`/wheels/public/${publicSlug}`);
      });

    await request(server)
      .patch(`/api/wheels/${wheel.id}`)
      .set("Cookie", authenticatedCookie)
      .send({ visibility: "private" })
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({ visibility: "private" });
        expect(response.body).not.toHaveProperty("publicSlug");
      });

    await request(server)
      .get(`/api/public/wheels/${publicSlug}`)
      .expect(404);

    await request(server)
      .patch(`/api/wheels/${wheel.id}/members/${memberUserId}`)
      .set("Cookie", authenticatedCookie)
      .send({ role: "viewer" })
      .expect(200);

    await request(server)
      .post(`/api/wheels/${wheel.id}/reset-history`)
      .set("Cookie", otherUserCookie)
      .expect(403);

    await request(server)
      .post(`/api/wheels/${wheel.id}/reset-history`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get(`/api/wheels/${wheel.id}/history`)
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect([]);

    await request(server)
      .delete(`/api/wheels/${wheel.id}`)
      .set("Cookie", otherUserCookie)
      .expect(403);

    await request(server)
      .delete(`/api/wheels/${wheel.id}/members/${memberUserId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get(`/api/wheels/${wheel.id}`)
      .set("Cookie", otherUserCookie)
      .expect(404);

    await request(server)
      .delete(`/api/friends/${friendshipId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .delete(`/api/wheels/${wheel.id}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    const { database } = await databaseService.getNativeConnection();
    expect(await database.collection("wheels").countDocuments()).toBe(0);
    expect(await database.collection("wheelItems").countDocuments()).toBe(
      0,
    );
    expect(await database.collection("wheelSpins").countDocuments()).toBe(
      0,
    );
  });

  it("shares an ordered private list through a one-time editor invitation", async () => {
    const firstMedia = readObject(
      (
        await request(server)
          .get("/api/media/tv/1")
          .set("Cookie", authenticatedCookie)
          .expect(200)
      ).body as unknown,
      "First shared-list media",
    );
    const secondMedia = readObject(
      (
        await request(server)
          .get("/api/media/tv/2")
          .set("Cookie", authenticatedCookie)
          .expect(200)
      ).body as unknown,
      "Second shared-list media",
    );
    expect(firstMedia).toMatchObject({ id: "tv:1" });
    expect(secondMedia).toMatchObject({ id: "tv:2" });
    const { database: sharedListDatabase } =
      await databaseService.getNativeConnection();
    const mediaSnapshotTime = new Date();
    const [firstStoredMedia, secondStoredMedia] = await Promise.all([
      sharedListDatabase.collection("media").findOneAndUpdate(
        { mediaType: "tv", tmdbId: 1 },
        {
          $set: {
            title: "Goblin",
            originalTitle: "도깨비",
            originCountry: ["KR"],
            genreIds: [18],
            lastSyncedAt: mediaSnapshotTime,
            updatedAt: mediaSnapshotTime,
          },
          $setOnInsert: { createdAt: mediaSnapshotTime },
        },
        { upsert: true, returnDocument: "after" },
      ),
      sharedListDatabase.collection("media").findOneAndUpdate(
        { mediaType: "tv", tmdbId: 2 },
        {
          $set: {
            title: "Crash Landing on You",
            originalTitle: "사랑의 불시착",
            originCountry: ["KR"],
            genreIds: [18],
            lastSyncedAt: mediaSnapshotTime,
            updatedAt: mediaSnapshotTime,
          },
          $setOnInsert: { createdAt: mediaSnapshotTime },
        },
        { upsert: true, returnDocument: "after" },
      ),
    ]);
    if (!firstStoredMedia || !secondStoredMedia) {
      throw new Error("Shared-list media snapshots were not persisted.");
    }
    const firstMediaId = firstStoredMedia._id.toHexString();
    const secondMediaId = secondStoredMedia._id.toHexString();
    const list = readObject(
      (
        await request(server)
          .post("/api/lists")
          .set("Cookie", authenticatedCookie)
          .send({ title: "Weekend dramas", description: "Watch together" })
          .expect(201)
      ).body as unknown,
      "Shared list",
    );
    const listId = readString(list["id"], "Shared-list ID");

    await request(server)
      .get(`/api/lists/${listId}`)
      .set("Cookie", otherUserCookie)
      .expect(404);

    const invite = readObject(
      (
        await request(server)
          .post(`/api/lists/${listId}/invites`)
          .set("Cookie", authenticatedCookie)
          .send({ username: "other_search_test", role: "editor" })
          .expect(201)
      ).body as unknown,
      "Shared-list invite",
    );
    const acceptUrl = readString(
      invite["acceptUrl"],
      "Shared-list invitation URL",
    );
    const token = new URL(acceptUrl).pathname.split("/").at(-1);
    expect(token).toHaveLength(43);
    const inviteId = readString(invite["id"], "Shared-list invitation ID");
    expect(invite).toMatchObject({
      id: inviteId,
      role: "editor",
      target: { username: "other_search_test" },
    });

    const refreshedInvite = readObject(
      (
        await request(server)
          .post(`/api/lists/${listId}/invites`)
          .set("Cookie", authenticatedCookie)
          .send({ username: "other_search_test", role: "editor" })
          .expect(201)
      ).body as unknown,
      "Refreshed shared-list invite",
    );
    expect(refreshedInvite["id"]).toBe(inviteId);
    const refreshedToken = new URL(
      readString(refreshedInvite["acceptUrl"], "Refreshed invitation URL"),
    ).pathname.split("/").at(-1);
    expect(refreshedToken).toHaveLength(43);

    await request(server)
      .post(`/api/list-invites/${token}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(400);

    await request(server)
      .post(`/api/list-invites/${refreshedToken}/accept`)
      .set("Cookie", authenticatedCookie)
      .expect(400)
      .expect({
        error: {
          code: "INVITE_INVALID",
          message: "This shared-list invitation is invalid or expired.",
        },
      });

    await request(server)
      .get("/api/notifications")
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response: Response) => {
        const items = readObjectArray(
          readObject(response.body as unknown, "Invitation notifications")["items"],
          "Invitation notification items",
        );
        const invitation = items.find(
          (entry) => entry["type"] === "shared_list_invite",
        );
        expect(
          items.filter((entry) => entry["type"] === "shared_list_invite"),
        ).toHaveLength(1);
        expect(invitation).toMatchObject({
          type: "shared_list_invite",
          entityId: inviteId,
          actor: { username: "search_test" },
        });
      });

    const acceptResponse = await request(server)
      .post(`/api/list-invites/${inviteId}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(201)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          id: listId,
          role: "editor",
          members: [
            { role: "owner", user: { username: "search_test" } },
            { role: "editor", user: { username: "other_search_test" } },
          ],
        });
      });
    const acceptedMembers = readObjectArray(
      readObject(acceptResponse.body as unknown, "Accepted shared list")["members"],
      "Accepted shared-list members",
    );
    const ownerMember = acceptedMembers.find(
      (member) => readObject(member, "Shared-list member")["role"] === "owner",
    );
    const editorMember = acceptedMembers.find(
      (member) => readObject(member, "Shared-list member")["role"] === "editor",
    );
    const ownerUserId = readString(
      readObject(
        readObject(ownerMember, "Shared-list owner member")["user"],
        "Shared-list owner user",
      )["id"],
      "Shared-list owner user ID",
    );
    const editorUserId = readString(
      readObject(
        readObject(editorMember, "Shared-list editor member")["user"],
        "Shared-list editor user",
      )["id"],
      "Shared-list editor user ID",
    );

    await request(server)
      .get("/api/notifications")
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response: Response) => {
        const items = readObjectArray(
          readObject(response.body as unknown, "Settled invitation notifications")["items"],
          "Settled invitation notification items",
        );
        expect(
          items.find((entry) => entry["entityId"] === inviteId),
        ).toMatchObject({ type: "shared_list_invite", isRead: true });
      });

    await request(server)
      .post(`/api/list-invites/${refreshedToken}/accept`)
      .set("Cookie", otherUserCookie)
      .expect(400)
      .expect({
        error: {
          code: "INVITE_INVALID",
          message: "This shared-list invitation is invalid or expired.",
        },
      });

    const firstItem = readObject(
      (
        await request(server)
          .post(`/api/lists/${listId}/items`)
          .set("Cookie", otherUserCookie)
          .send({
            mediaId: firstMediaId,
            note: "Start here",
            groupStatus: "watching",
            groupProgress: { currentSeason: 1, currentEpisode: 2 },
          })
          .expect(201)
      ).body as unknown,
      "First shared-list item",
    );
    const secondItem = readObject(
      (
        await request(server)
          .post(`/api/lists/${listId}/items`)
          .set("Cookie", authenticatedCookie)
          .send({ mediaId: secondMediaId })
          .expect(201)
      ).body as unknown,
      "Second shared-list item",
    );
    const firstItemId = readString(firstItem["id"], "First item ID");
    const secondItemId = readString(secondItem["id"], "Second item ID");

    await request(server)
      .post(`/api/lists/${listId}/items`)
      .set("Cookie", otherUserCookie)
      .send({ mediaId: firstMediaId })
      .expect(409)
      .expect({
        error: {
          code: "SHARED_LIST_ITEM_ALREADY_EXISTS",
          message: "This title is already on the shared list.",
        },
      });

    await request(server)
      .post(`/api/lists/${listId}/reorder`)
      .set("Cookie", otherUserCookie)
      .send({ itemIds: [secondItemId, firstItemId] })
      .expect(201)
      .expect((response: Response) => {
        expect(response.body).toMatchObject([
          { id: secondItemId, position: 0 },
          {
            id: firstItemId,
            position: 1,
            note: "Start here",
            groupStatus: "watching",
            groupProgress: { currentSeason: 1, currentEpisode: 2 },
          },
        ]);
      });

    const comment = readObject(
      (
        await request(server)
          .post(`/api/lists/${listId}/items/${firstItemId}/comments`)
          .set("Cookie", authenticatedCookie)
          .send({ body: "The ending is worth discussing.", hasSpoiler: true })
          .expect(201)
      ).body as unknown,
      "Shared-list comment",
    );
    const commentId = readString(comment["id"], "Shared-list comment ID");
    expect(comment).toMatchObject({
      body: "The ending is worth discussing.",
      hasSpoiler: true,
      author: { username: "search_test" },
    });

    const reply = readObject(
      (
        await request(server)
          .post(`/api/lists/${listId}/items/${firstItemId}/comments`)
          .set("Cookie", otherUserCookie)
          .send({ body: "I agree.", parentCommentId: commentId })
          .expect(201)
      ).body as unknown,
      "Shared-list reply",
    );
    const replyId = readString(reply["id"], "Shared-list reply ID");

    await request(server)
      .patch(`/api/comments/${commentId}`)
      .set("Cookie", otherUserCookie)
      .send({ body: "Editors cannot edit another author." })
      .expect(403);

    await request(server)
      .delete(`/api/comments/${replyId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get(`/api/lists/${listId}/items/${firstItemId}/comments`)
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: commentId, hasSpoiler: true }),
          ]),
        );
        const deletedReply = readObjectArray(
          response.body as unknown,
          "Shared-list comments",
        ).find((entry) => entry["id"] === replyId);
        expect(deletedReply).toMatchObject({
          id: replyId,
          isDeleted: true,
          hasSpoiler: false,
        });
        expect(deletedReply).not.toHaveProperty("body");
      });

    await request(server)
      .get("/api/notifications")
      .set("Cookie", authenticatedCookie)
      .expect(200)
      .expect((response: Response) => {
        const items = readObjectArray(
          readObject(response.body as unknown, "Comment notifications")["items"],
          "Comment notification items",
        );
        const replyNotification = items.find(
          (entry) => entry["type"] === "comment_reply",
        );
        expect(replyNotification).toMatchObject({
          type: "comment_reply",
          entityId: listId,
        });
        expect(
          readObject(replyNotification?.["actor"], "Reply notification actor"),
        ).toMatchObject({ username: "other_search_test" });
        expect(items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "shared_item_updated",
              entityId: listId,
            }),
          ]),
        );
      });

    await request(server)
      .patch(`/api/lists/${listId}/members/${ownerUserId}`)
      .set("Cookie", authenticatedCookie)
      .send({ role: "viewer" })
      .expect(404);

    await request(server)
      .patch(`/api/lists/${listId}/members/${ownerUserId}`)
      .set("Cookie", otherUserCookie)
      .send({ role: "viewer" })
      .expect(403);

    await request(server)
      .patch(`/api/lists/${listId}/members/${editorUserId}`)
      .set("Cookie", authenticatedCookie)
      .send({ role: "commenter" })
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          role: "commenter",
          user: { id: editorUserId },
        });
      });

    await request(server)
      .patch(`/api/lists/${listId}/items/${firstItemId}`)
      .set("Cookie", otherUserCookie)
      .send({ note: "Commenters cannot edit items." })
      .expect(403);

    await request(server)
      .post(`/api/lists/${listId}/items/${firstItemId}/comments`)
      .set("Cookie", otherUserCookie)
      .send({ body: "Commenters can still join the discussion." })
      .expect(201);

    await request(server)
      .patch(`/api/lists/${listId}/members/${editorUserId}`)
      .set("Cookie", authenticatedCookie)
      .send({ role: "viewer" })
      .expect(200);

    await request(server)
      .post(`/api/lists/${listId}/items/${firstItemId}/comments`)
      .set("Cookie", otherUserCookie)
      .send({ body: "Viewers cannot comment." })
      .expect(403);

    await request(server)
      .patch(`/api/lists/${listId}`)
      .set("Cookie", otherUserCookie)
      .send({ title: "Editors cannot rename" })
      .expect(403);

    await request(server)
      .get("/api/lists")
      .set("Cookie", otherUserCookie)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: listId,
              role: "viewer",
              itemCount: 2,
            }),
          ]),
        );
      });

    const unlistedList = readObject(
      (
        await request(server)
          .patch(`/api/lists/${listId}`)
          .set("Cookie", authenticatedCookie)
          .send({ visibility: "unlisted" })
          .expect(200)
      ).body as unknown,
      "Unlisted shared list",
    );
    const publicSlug = readString(
      unlistedList["publicSlug"],
      "Shared-list public slug",
    );
    expect(publicSlug).toHaveLength(16);

    await request(server)
      .get(`/api/public/lists/${publicSlug}`)
      .expect(200)
      .expect((response: Response) => {
        const publicList = readObject(
          response.body as unknown,
          "Public shared-list response",
        );
        expect(publicList).toMatchObject({
          title: "Weekend dramas",
          visibility: "unlisted",
          publicSlug,
          itemCount: 2,
        });
        expect(publicList).not.toHaveProperty("id");
        const publicItems = readObjectArray(
          publicList["items"],
          "Public shared-list items",
        );
        expect(publicItems).toHaveLength(2);
        for (const item of publicItems) {
          expect(item).not.toHaveProperty("id");
          expect(item).not.toHaveProperty("mediaId");
          expect(readObject(item["media"], "Public shared-list media")).not.toHaveProperty(
            "id",
          );
        }
        expect(JSON.stringify(publicList)).not.toContain("@example.com");
      });

    await request(server)
      .get(`/api/public/lists/share/${publicSlug}`)
      .expect("Content-Type", /text\/html/)
      .expect("Cache-Control", "no-store")
      .expect(200)
      .expect((response: Response) => {
        expect(response.text).toContain(
          '<meta name="robots" content="noindex, nofollow">',
        );
        expect(response.text).toContain(`/lists/public/${publicSlug}`);
        expect(response.text).not.toContain("@example.com");
      });

    await request(server)
      .get("/api/public/seo/sitemap.xml")
      .expect(200)
      .expect((response: Response) => {
        expect(response.text).not.toContain(`/lists/public/${publicSlug}`);
      });

    await request(server)
      .patch(`/api/lists/${listId}`)
      .set("Cookie", authenticatedCookie)
      .send({ visibility: "public" })
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          visibility: "public",
          publicSlug,
        });
      });

    await request(server)
      .get("/api/public/seo/sitemap.xml")
      .expect(200)
      .expect((response: Response) => {
        expect(response.text).toContain(`/lists/public/${publicSlug}`);
      });

    await request(server)
      .patch(`/api/lists/${listId}`)
      .set("Cookie", authenticatedCookie)
      .send({ visibility: "private" })
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({ visibility: "private" });
        expect(response.body).not.toHaveProperty("publicSlug");
      });

    await request(server)
      .get(`/api/public/lists/${publicSlug}`)
      .expect(404);

    await request(server)
      .delete(`/api/lists/${listId}/members/${editorUserId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    await request(server)
      .get(`/api/lists/${listId}`)
      .set("Cookie", otherUserCookie)
      .expect(404);

    await request(server)
      .delete(`/api/lists/${listId}`)
      .set("Cookie", otherUserCookie)
      .expect(404);
    await request(server)
      .delete(`/api/lists/${listId}`)
      .set("Cookie", authenticatedCookie)
      .expect(204);

    const { database } = await databaseService.getNativeConnection();
    expect(await database.collection("sharedLists").countDocuments()).toBe(0);
    expect(await database.collection("sharedListItems").countDocuments()).toBe(0);
    expect(await database.collection("sharedListInvites").countDocuments()).toBe(0);
    expect(await database.collection("comments").countDocuments()).toBe(0);
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

  it("verifies a registered email before onboarding and login", async () => {
    const email = `integration-${Date.now()}@example.com`;
    const password = "correct-horse-battery-staple";
    const signUpResponse = await request(server)
      .post("/api/auth/sign-up/email")
      .set("Origin", "http://localhost:4200")
      .send({
        email,
        name: "Integration User",
        password,
        callbackURL: "http://localhost:4200/onboarding",
      })
      .expect(200);

    expect(signUpResponse.body).toMatchObject({
      token: null,
      user: {
        email,
        name: "Integration User",
      },
    });
    expect(signUpResponse.headers["set-cookie"]).toBeUndefined();

    await request(server)
      .post("/api/auth/sign-in/email")
      .set("Origin", "http://localhost:4200")
      .send({ email, password, rememberMe: true })
      .expect(403);

    const verificationUrl = requireCapturedUrl(
      emailService.verificationUrls,
      email,
      "verification",
    );
    const verificationResponse = await followAuthenticationLink(
      server,
      verificationUrl,
    );
    const cookie = readCookie(verificationResponse);

    expect(verificationResponse.headers.location).toBe(
      "http://localhost:4200/onboarding",
    );
    expect(cookie).toMatch(/^__session=/);

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

  it("resets a password generically and revokes existing sessions", async () => {
    const email = `reset-${Date.now()}@example.com`;
    const originalPassword = "correct-horse-battery-staple";
    const newPassword = "new-correct-horse-battery-staple";
    const cookie = await registerTestUser(
      server,
      email,
      "Reset User",
      emailService,
      originalPassword,
    );
    const resetRequest = {
      email,
      redirectTo: "http://localhost:4200/reset-password",
    };
    const genericResponse = {
      status: true,
      message:
        "If this email exists in our system, check your email for the reset link",
    };

    await request(server)
      .post("/api/auth/request-password-reset")
      .set("Origin", "http://localhost:4200")
      .send(resetRequest)
      .expect(200)
      .expect(genericResponse);

    await request(server)
      .post("/api/auth/request-password-reset")
      .set("Origin", "http://localhost:4200")
      .send({
        ...resetRequest,
        email: `unknown-${Date.now()}@example.com`,
      })
      .expect(200)
      .expect(genericResponse);

    const resetUrl = requireCapturedUrl(
      emailService.passwordResetUrls,
      email,
      "password reset",
    );
    const redirectResponse = await followAuthenticationLink(
      server,
      resetUrl,
    );
    const redirectLocation = redirectResponse.headers.location;

    if (typeof redirectLocation !== "string") {
      throw new Error("Password reset link did not return a redirect");
    }

    const token = new URL(redirectLocation).searchParams.get("token");

    if (!token) {
      throw new Error("Password reset redirect did not contain a token");
    }

    await request(server)
      .post("/api/auth/reset-password")
      .set("Origin", "http://localhost:4200")
      .send({ newPassword, token })
      .expect(200)
      .expect({ status: true });

    await request(server)
      .get("/api/test/protected")
      .set("Cookie", cookie)
      .expect(401);

    await request(server)
      .post("/api/auth/sign-in/email")
      .set("Origin", "http://localhost:4200")
      .send({
        email,
        password: originalPassword,
        rememberMe: true,
      })
      .expect(401);

    const signInResponse = await request(server)
      .post("/api/auth/sign-in/email")
      .set("Origin", "http://localhost:4200")
      .send({ email, password: newPassword, rememberMe: true })
      .expect(200);

    expect(readCookie(signInResponse)).toMatch(/^__session=/);

    await request(server)
      .post("/api/auth/reset-password")
      .set("Origin", "http://localhost:4200")
      .send({ newPassword: originalPassword, token })
      .expect(400);
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
  emailService: CapturingTransactionalEmailService,
  password = "correct-horse-battery-staple",
): Promise<string> {
  await request(server)
    .post("/api/auth/sign-up/email")
    .set("Origin", "http://localhost:4200")
    .send({
      email,
      name,
      password,
      callbackURL: "http://localhost:4200/onboarding",
    })
    .expect(200);

  const verificationUrl = requireCapturedUrl(
    emailService.verificationUrls,
    email,
    "verification",
  );
  const response = await followAuthenticationLink(
    server,
    verificationUrl,
  );

  return readCookie(response);
}

async function setTestUsername(
  server: Server,
  cookie: string,
  username: string,
): Promise<void> {
  await request(server)
    .post("/api/auth/update-user")
    .set("Cookie", cookie)
    .set("Origin", "http://localhost:4200")
    .send({ username })
    .expect(200);
}

async function followAuthenticationLink(
  server: Server,
  actionUrl: string,
): Promise<Response> {
  const url = new URL(actionUrl);

  return request(server)
    .get(`${url.pathname}${url.search}`)
    .redirects(0)
    .expect((response) => {
      expect([302, 303]).toContain(response.status);
    });
}

function requireCapturedUrl(
  urls: ReadonlyMap<string, string>,
  email: string,
  label: string,
): string {
  const url = urls.get(email);

  if (!url) {
    throw new Error(`No ${label} email was captured for ${email}`);
  }

  return url;
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

function readObjectArray(
  value: unknown,
  label: string,
): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) => typeof item === "object" && item !== null,
    )
  ) {
    throw new Error(`${label} response was not an object array`);
  }

  return value as Record<string, unknown>[];
}

function readObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} response was not an object`);
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} was not a string`);
  }

  return value;
}

function readPriorityLanes(value: unknown): Array<{ id: string }> {
  if (!Array.isArray(value)) {
    throw new Error("Priority lane response was not an array");
  }

  return value.map(readPriorityLane);
}

function readPriorityLane(value: unknown): { id: string } {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("Priority lane response did not contain an identifier");
  }

  return { id: value.id };
}

function readWheel(value: unknown): { id: string } {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("Wheel response did not contain an identifier");
  }

  return { id: value.id };
}

function readWheelItem(value: unknown): { id: string } {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("Wheel item response did not contain an identifier");
  }

  return { id: value.id };
}

function readWheelSpin(value: unknown): {
  spinId: string;
  wheelItemId: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("spinId" in value) ||
    typeof value.spinId !== "string" ||
    !("selectedItem" in value) ||
    typeof value.selectedItem !== "object" ||
    value.selectedItem === null ||
    !("wheelItemId" in value.selectedItem) ||
    typeof value.selectedItem.wheelItemId !== "string"
  ) {
    throw new Error("Wheel spin response did not contain identifiers");
  }

  return {
    spinId: value.spinId,
    wheelItemId: value.selectedItem.wheelItemId,
  };
}
