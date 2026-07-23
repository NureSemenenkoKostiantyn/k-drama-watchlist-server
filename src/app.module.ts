import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import {
  ThrottlerGuard,
  ThrottlerModule,
} from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { getRequestTracker } from "./common/throttling/request-tracker";
import { AuthenticationModule } from "./auth/authentication.module";
import {
  type Environment,
  validateEnvironment,
} from "./config/environment";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { MediaModule } from "./modules/media/media.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<Environment, true>,
      ) => ({
        errorMessage: "Too many requests.",
        getTracker: getRequestTracker,
        throttlers: [
          {
            limit: configService.getOrThrow<number>("RATE_LIMIT_MAX"),
            ttl: configService.getOrThrow<number>("RATE_LIMIT_TTL_MS"),
          },
        ],
      }),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<Environment, true>,
      ) => ({
        pinoHttp: {
          level: configService.getOrThrow<string>("LOG_LEVEL"),
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              'res.headers["set-cookie"]',
            ],
            censor: "[Redacted]",
          },
        },
      }),
    }),
    DatabaseModule,
    AuthenticationModule,
    HealthModule,
    MediaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
