import { getCookies } from "better-auth/cookies";
import { jest } from "@jest/globals";

import { NodeEnvironment } from "../config/environment";
import { type TransactionalEmailService } from "../integrations/email/transactional-email.service";
import {
  createDramaWatchAuth,
  createMcpResourceUrl,
  MCP_READ_SCOPES,
  MCP_SCOPES,
  MCP_WRITE_SCOPES,
} from "./auth.factory";

describe("createDramaWatchAuth", () => {
  const sendEmailVerification = jest.fn(() => Promise.resolve());
  const sendPasswordReset = jest.fn(() => Promise.resolve());
  const emailService = {
    sendEmailVerification,
    sendPasswordReset,
  } as unknown as TransactionalEmailService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createNativeConnection(): Parameters<
    typeof createDramaWatchAuth
  >[0] {
    const collection = {
      aggregate: jest.fn(() => ({
        toArray: jest.fn(() => Promise.resolve([])),
      })),
      createIndex: jest.fn(() => Promise.resolve("index")),
      insertOne: jest.fn(() =>
        Promise.resolve({ insertedId: "test-object-id" }),
      ),
    };

    return {
      client: {},
      database: {
        collection: jest.fn(() => collection),
      },
    } as unknown as Parameters<typeof createDramaWatchAuth>[0];
  }

  it("configures same-origin auth routes and the username plugin", () => {
    const nativeConnection = createNativeConnection();
    const environment: Parameters<typeof createDramaWatchAuth>[1] = {
      NODE_ENV: NodeEnvironment.Test,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:8080",
      FRONTEND_URL: "http://localhost:4200",
    };

    const auth = createDramaWatchAuth(
      nativeConnection,
      environment,
      emailService,
    );

    expect(auth.options.basePath).toBe("/api/auth");
    expect(auth.options.trustedOrigins).toEqual(["http://localhost:4200"]);
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(
      auth.options.emailAndPassword?.requireEmailVerification,
    ).toBe(true);
    expect(
      auth.options.emailAndPassword?.revokeSessionsOnPasswordReset,
    ).toBe(true);
    expect(auth.options.emailVerification).toMatchObject({
      autoSignInAfterVerification: true,
      expiresIn: 3_600,
      sendOnSignIn: false,
      sendOnSignUp: true,
    });
    expect(auth.options.advanced?.cookies?.session_token?.name).toBe(
      "__session",
    );
    expect(auth.options.plugins?.map((plugin) => plugin.id)).toContain(
      "username",
    );
    expect(auth.options.plugins?.map((plugin) => plugin.id)).toEqual(
      expect.arrayContaining(["jwt", "oauth-provider", "cimd"]),
    );
    expect(createMcpResourceUrl(environment.BETTER_AUTH_URL)).toBe(
      "http://localhost:8080/api/mcp",
    );
    expect(MCP_SCOPES).toEqual([
      "openid",
      "profile",
      ...MCP_READ_SCOPES,
      ...MCP_WRITE_SCOPES,
    ]);
  });

  it("uses the public app for MCP login and consent redirects", () => {
    const nativeConnection = createNativeConnection();
    const environment: Parameters<typeof createDramaWatchAuth>[1] = {
      NODE_ENV: NodeEnvironment.Production,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "https://dahyun.best",
      FRONTEND_URL: "https://dahyun.best",
    };

    const auth = createDramaWatchAuth(
      nativeConnection,
      environment,
      emailService,
    );
    const oauthProvider = auth.options.plugins?.find(
      (plugin) => plugin.id === "oauth-provider",
    );

    expect(oauthProvider).toBeDefined();
    expect(createMcpResourceUrl(environment.BETTER_AUTH_URL)).toBe(
      "https://dahyun.best/api/mcp",
    );
  });

  it("keeps the Firebase session cookie name exact and secure in production", () => {
    const nativeConnection = createNativeConnection();
    const environment: Parameters<typeof createDramaWatchAuth>[1] = {
      NODE_ENV: NodeEnvironment.Production,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "https://dahyun.best",
      FRONTEND_URL: "https://dahyun.best",
    };

    const auth = createDramaWatchAuth(
      nativeConnection,
      environment,
      emailService,
    );
    const { sessionToken } = getCookies(auth.options);

    expect(sessionToken.name).toBe("__session");
    expect(sessionToken.attributes.secure).toBe(true);
  });

  it("delegates Better Auth links to the transactional sender", async () => {
    const nativeConnection = createNativeConnection();
    const environment: Parameters<typeof createDramaWatchAuth>[1] = {
      NODE_ENV: NodeEnvironment.Test,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:8080",
      FRONTEND_URL: "http://localhost:4200",
    };
    const auth = createDramaWatchAuth(
      nativeConnection,
      environment,
      emailService,
    );
    const user = {
      id: "user-id",
      email: "viewer@example.com",
      emailVerified: false,
      name: "Viewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await auth.options.emailVerification?.sendVerificationEmail?.(
      {
        token: "verification-token",
        url: "http://localhost:8080/api/auth/verify-email?token=value",
        user,
      },
    );
    await auth.options.emailAndPassword?.sendResetPassword?.(
      {
        token: "reset-token",
        url: "http://localhost:8080/api/auth/reset-password/reset-token",
        user,
      },
    );

    expect(sendEmailVerification).toHaveBeenCalledWith({
      actionUrl:
        "http://localhost:8080/api/auth/verify-email?token=value",
      recipientEmail: "viewer@example.com",
      recipientName: "Viewer",
    });
    expect(sendPasswordReset).toHaveBeenCalledWith({
      actionUrl:
        "http://localhost:8080/api/auth/reset-password/reset-token",
      recipientEmail: "viewer@example.com",
      recipientName: "Viewer",
    });
  });
});
