import {
  Transform,
  type TransformFnParams,
  Type,
} from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { MediaType } from "../../../common/types/media.types";

export class CreateSuggestionDto {
  @Transform(trimString)
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_.]+$/)
  username!: string;

  @IsEnum(MediaType)
  mediaType!: MediaType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  tmdbId!: number;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}

function trimOptionalString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value !== "string") {
    return value;
  }

  return value.trim() || undefined;
}
