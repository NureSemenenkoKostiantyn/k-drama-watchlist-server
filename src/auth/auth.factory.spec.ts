import { getCookies } from "better-auth/cookies";
import { jest } from "@jest/globals";

import { NodeEnvironment } from "../config/environment";
import { type TransactionalEmailService } from "../integrations/email/transactional-email.service";
import { createDramaWatchAuth } from "./auth.factory";

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
