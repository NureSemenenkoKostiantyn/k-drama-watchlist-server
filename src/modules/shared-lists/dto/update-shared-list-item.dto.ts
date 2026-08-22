import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import { SharedListItemStatus } from "../../../common/types/shared-list.types";
import { SharedListProgressDto } from "./shared-list-progress.dto";
import { trimString } from "./shared-list-text.transform";

export class UpdateSharedListItemDto {
  @IsOptional()
  @Transform(trimString)
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(2_000)
  note?: string | null;

  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsEnum(SharedListItemStatus)
  groupStatus?: SharedListItemStatus | null;

  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @ValidateNested()
  @Type(() => SharedListProgressDto)
  groupProgress?: SharedListProgressDto | null;
}
