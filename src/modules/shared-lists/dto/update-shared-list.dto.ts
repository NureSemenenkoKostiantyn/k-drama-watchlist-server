import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { trimString } from "./shared-list-text.transform";

export class UpdateSharedListDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  title?: string;

  @IsOptional()
  @Transform(trimString)
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(2_000)
  description?: string | null;
}
