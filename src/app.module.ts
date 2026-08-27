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
import { ActivityModule } from "./modules/activity/activity.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { DataExportModule } from "./modules/data-export/data-export.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { FriendsModule } from "./modules/friends/friends.module";
import { HealthModule } from "./modules/health/health.module";
import { LibraryModule } from "./modules/library/library.module";
import { MediaModule } from "./modules/media/media.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PriorityModule } from "./modules/priority/priority.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SeoModule } from "./modules/seo/seo.module";
import { SharedListsModule } from "./modules/shared-lists/shared-lists.module";
import { StatisticsModule } from "./modules/statistics/statistics.module";
import { SuggestionsModule } from "./modules/suggestions/suggestions.module";
import { UsersModule } from "./modules/users/users.module";
import { WheelsModule } from "./modules/wheels/wheels.module";

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
    ActivityModule,
    CategoriesModule,
    CommentsModule,
    DataExportModule,
    DiscoveryModule,
    FriendsModule,
    HealthModule,
    MediaModule,
    LibraryModule,
    NotificationsModule,
    PriorityModule,
    ProfilesModule,
    SeoModule,
    SettingsModule,
    SharedListsModule,
    StatisticsModule,
    SuggestionsModule,
    UsersModule,
    WheelsModule,
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
