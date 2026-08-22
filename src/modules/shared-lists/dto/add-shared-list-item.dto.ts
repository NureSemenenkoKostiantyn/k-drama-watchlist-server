import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { SharedListItemStatus } from "../../../common/types/shared-list.types";
import { SharedListProgressDto } from "./shared-list-progress.dto";
import { trimString } from "./shared-list-text.transform";

export class AddSharedListItemDto {
  @IsMongoId()
  mediaId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2_000)
  note?: string;

  @IsOptional()
  @IsEnum(SharedListItemStatus)
  groupStatus?: SharedListItemStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => SharedListProgressDto)
  groupProgress?: SharedListProgressDto;
}
