import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "@thallesp/nestjs-better-auth";

import { type Environment } from "../config/environment";
import { DatabaseModule } from "../database/database.module";
import { MongooseDatabaseService } from "../database/mongoose-database.service";
import { createDramaWatchAuth } from "./auth.factory";

@Module({
  imports: [
    AuthModule.forRootAsync({
      disableGlobalAuthGuard: true,
      imports: [ConfigModule, DatabaseModule],
      inject: [MongooseDatabaseService, ConfigService],
      useFactory: async (
        databaseService: MongooseDatabaseService,
        configService: ConfigService<Environment, true>,
      ) => {
        const nativeConnection = await databaseService.getNativeConnection();

        return {
          auth: createDramaWatchAuth(
            nativeConnection,
            readEnvironment(configService),
          ),
        };
      },
    }),
  ],
})
export class AuthenticationModule {}

function readEnvironment(
  configService: ConfigService<Environment, true>,
): Parameters<typeof createDramaWatchAuth>[1] {
  return {
    NODE_ENV: configService.getOrThrow("NODE_ENV"),
    BETTER_AUTH_SECRET: configService.getOrThrow("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: configService.getOrThrow("BETTER_AUTH_URL"),
    FRONTEND_URL: configService.getOrThrow("FRONTEND_URL"),
  };
}
