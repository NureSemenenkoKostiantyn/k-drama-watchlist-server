import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, ValidateNested } from "class-validator";

import {
  ActivityVisibility,
  LibraryVisibility,
  TierBoardMode,
} from "../../../common/types/settings.types";

export class UpdateTelegramNotificationsDto {
  @IsOptional()
  @IsBoolean()
  friendRequests?: boolean;

  @IsOptional()
  @IsBoolean()
  titleSuggestions?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(TierBoardMode)
  tierBoardMode?: TierBoardMode;

  @IsOptional()
  @IsEnum(LibraryVisibility)
  libraryVisibility?: LibraryVisibility;

  @IsOptional()
  @IsEnum(ActivityVisibility)
  activityVisibility?: ActivityVisibility;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTelegramNotificationsDto)
  telegramNotifications?: UpdateTelegramNotificationsDto;
}
