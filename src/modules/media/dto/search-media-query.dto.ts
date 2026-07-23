import { Transform, type TransformFnParams, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

import { SearchMediaType } from "../../../common/types/media.types";

export class SearchMediaQuery {
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  q!: string;

  @IsEnum(SearchMediaType)
  type: SearchMediaType = SearchMediaType.All;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page = 1;

  @IsOptional()
  @Transform(uppercaseString)
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}

function uppercaseString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.toUpperCase() : value;
}
