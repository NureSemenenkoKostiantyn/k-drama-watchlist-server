import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins";

import { NodeEnvironment, type Environment } from "../config/environment";
import { type MongooseDatabaseService } from "../database/mongoose-database.service";

type NativeConnection = Awaited<
  ReturnType<MongooseDatabaseService["getNativeConnection"]>
>;

export function createDramaWatchAuth(
  nativeConnection: NativeConnection,
  environment: Environment,
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
      useSecureCookies: environment.NODE_ENV === NodeEnvironment.Production,
    },
  });
}

export type DramaWatchAuth = ReturnType<typeof createDramaWatchAuth>;
