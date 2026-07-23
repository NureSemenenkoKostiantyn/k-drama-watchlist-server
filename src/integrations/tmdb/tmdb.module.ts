import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { type Environment } from "../../config/environment";
import { TmdbClient } from "./tmdb.client";

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<Environment, true>,
      ) => ({
        baseURL: "https://api.themoviedb.org/3",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${configService.getOrThrow<string>("TMDB_ACCESS_TOKEN")}`,
        },
        maxRedirects: 0,
        timeout: 5_000,
      }),
    }),
  ],
  providers: [TmdbClient],
  exports: [TmdbClient],
})
export class TmdbModule {}
