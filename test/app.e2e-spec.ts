import { type Server } from "node:http";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";

describe("application (e2e)", () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns the exact health contract", async () => {
    await request(server)
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
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
