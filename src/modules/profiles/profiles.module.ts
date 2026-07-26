import { Module } from "@nestjs/common";

import { FriendsModule } from "../friends/friends.module";
import { LibraryModule } from "../library/library.module";
import { SettingsModule } from "../settings/settings.module";
import { UsersModule } from "../users/users.module";
import { PublicLibraryController } from "./public-library.controller";
import { PublicLibraryRepository } from "./public-library.repository";
import { PublicLibraryService } from "./public-library.service";

@Module({
  imports: [
    FriendsModule,
    LibraryModule,
    SettingsModule,
    UsersModule,
  ],
  controllers: [PublicLibraryController],
  providers: [PublicLibraryRepository, PublicLibraryService],
})
export class ProfilesModule {}
