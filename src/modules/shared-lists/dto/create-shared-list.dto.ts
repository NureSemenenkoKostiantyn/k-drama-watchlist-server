import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

import { trimString } from "./shared-list-text.transform";

export class CreateSharedListDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2_000)
  description?: string;
}
