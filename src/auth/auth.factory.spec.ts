import { getCookies } from "better-auth/cookies";

import { NodeEnvironment } from "../config/environment";
import { createDramaWatchAuth } from "./auth.factory";

describe("createDramaWatchAuth", () => {
  it("configures same-origin auth routes and the username plugin", () => {
    const nativeConnection = {
      client: {},
      database: {},
    } as unknown as Parameters<typeof createDramaWatchAuth>[0];
    const environment: Parameters<typeof createDramaWatchAuth>[1] = {
      NODE_ENV: NodeEnvironment.Test,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:8080",
      FRONTEND_URL: "http://localhost:4200",
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

  it("keeps the Firebase session cookie name exact and secure in production", () => {
    const nativeConnection = {
      client: {},
      database: {},
    } as unknown as Parameters<typeof createDramaWatchAuth>[0];
    const environment: Parameters<typeof createDramaWatchAuth>[1] = {
      NODE_ENV: NodeEnvironment.Production,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "https://dahyun.best",
      FRONTEND_URL: "https://dahyun.best",
    };

    const auth = createDramaWatchAuth(nativeConnection, environment);
    const { sessionToken } = getCookies(auth.options);

    expect(sessionToken.name).toBe("__session");
    expect(sessionToken.attributes.secure).toBe(true);
  });
});
