import { IsEnum } from "class-validator";

import { LibraryVisibility } from "../../../common/types/settings.types";

export class UpdateSettingsDto {
  @IsEnum(LibraryVisibility)
  libraryVisibility!: LibraryVisibility;
}
