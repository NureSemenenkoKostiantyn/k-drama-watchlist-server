import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  ValidateNested,
} from "class-validator";

import {
  ActivityVisibility,
  LibraryVisibility,
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
