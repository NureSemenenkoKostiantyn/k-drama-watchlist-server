import { NodeEnvironment, type Environment } from "../config/environment";
import { createDramaWatchAuth } from "./auth.factory";

describe("createDramaWatchAuth", () => {
  it("configures same-origin auth routes and the username plugin", () => {
    const nativeConnection = {
      client: {},
      database: {},
    } as unknown as Parameters<typeof createDramaWatchAuth>[0];
    const environment: Environment = {
      NODE_ENV: NodeEnvironment.Test,
      PORT: 8080,
      MONGODB_URI: "mongodb://127.0.0.1:27017",
      MONGODB_DB_NAME: "drama_watch_test",
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:8080",
      FRONTEND_URL: "http://localhost:4200",
      LOG_LEVEL: "silent",
    };

    const auth = createDramaWatchAuth(nativeConnection, environment);

    expect(auth.options.basePath).toBe("/api/auth");
    expect(auth.options.trustedOrigins).toEqual(["http://localhost:4200"]);
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.advanced?.cookies?.session_token?.name).toBe(
      "__session",
    );
    expect(auth.options.plugins?.map((plugin) => plugin.id)).toContain(
      "username",
    );
  });
});
