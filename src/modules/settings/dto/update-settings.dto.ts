import { IsEnum, IsOptional } from "class-validator";

import {
  ActivityVisibility,
  LibraryVisibility,
} from "../../../common/types/settings.types";

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(LibraryVisibility)
  libraryVisibility?: LibraryVisibility;

  @IsOptional()
  @IsEnum(ActivityVisibility)
  activityVisibility?: ActivityVisibility;
}
