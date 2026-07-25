import {
  Transform,
  type TransformFnParams,
} from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

import { WheelSelectionMode } from "../../../common/types/wheel.types";

export class UpdateWheelDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  title?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1_000)
  description?: string | null;

  @IsOptional()
  @IsEnum(WheelSelectionMode)
  selectionMode?: WheelSelectionMode;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
