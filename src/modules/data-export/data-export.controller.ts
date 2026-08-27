import { Controller, Get, Header } from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type AccountDataExportResponse } from "../../common/types/data-export.types";
import { DataExportService } from "./data-export.service";

@Controller("account/export")
export class DataExportController {
  constructor(
    private readonly dataExportService: DataExportService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  exportAccount(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<AccountDataExportResponse> {
    return this.dataExportService.exportAccount(session.user.id);
  }
}
