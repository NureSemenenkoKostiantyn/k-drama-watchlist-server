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
import { IsString, MaxLength } from "class-validator";
import request, { type Response } from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";
import { MongooseDatabaseService } from "../src/database/mongoose-database.service";

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApplication(app);
    await app.init();
    server = app.getHttpServer() as Server;
    databaseService = app.get(MongooseDatabaseService);

    const { database } = await databaseService.getNativeConnection();
    assertTestDatabase(database.databaseName);
    await database.dropDatabase();
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
