import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins";

import { NodeEnvironment, type Environment } from "../config/environment";
import { type MongooseDatabaseService } from "../database/mongoose-database.service";
import { type TransactionalEmailService } from "../integrations/email/transactional-email.service";

type NativeConnection = Awaited<
  ReturnType<MongooseDatabaseService["getNativeConnection"]>
>;

type AuthEnvironment = Pick<
  Environment,
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "FRONTEND_URL"
  | "NODE_ENV"
>;

export function createDramaWatchAuth(
  nativeConnection: NativeConnection,
  environment: AuthEnvironment,
  emailService: TransactionalEmailService,
) {
  return betterAuth({
    appName: "Drama Watch",
    basePath: "/api/auth",
    baseURL: environment.BETTER_AUTH_URL,
    database: mongodbAdapter(nativeConnection.database, {
      client: nativeConnection.client,
      transaction: environment.NODE_ENV === NodeEnvironment.Production,
    }),
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 8,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        emailService.sendPasswordReset({
          actionUrl: url,
          recipientEmail: user.email,
          recipientName: user.name,
        }),
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendOnSignIn: false,
      sendOnSignUp: true,
      sendVerificationEmail: ({ user, url }) =>
        emailService.sendEmailVerification({
          actionUrl: url,
          recipientEmail: user.email,
          recipientName: user.name,
        }),
    },
    plugins: [
      username({
        maxUsernameLength: 30,
        minUsernameLength: 3,
      }),
    ],
    secret: environment.BETTER_AUTH_SECRET,
    trustedOrigins: [environment.FRONTEND_URL],
    advanced: {
      cookiePrefix: "drama-watch",
      cookies: {
        session_token: {
          name: "__session",
        },
      },
      defaultCookieAttributes: {
        secure: environment.NODE_ENV === NodeEnvironment.Production,
      },
      // A secure-cookie name prefix would make Firebase Hosting strip the cookie.
      useSecureCookies: false,
    },
  });
}

export type DramaWatchAuth = ReturnType<typeof createDramaWatchAuth>;
