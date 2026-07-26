import { Body, Controller, Get, Patch } from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type UserSettingsResponse } from "../../common/types/settings.types";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<UserSettingsResponse> {
    return this.settingsService.get(session.user.id);
  }

  @Patch()
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    return this.settingsService.update(session.user.id, input);
  }
}
