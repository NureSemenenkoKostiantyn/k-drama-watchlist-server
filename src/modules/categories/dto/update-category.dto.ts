import {
  Transform,
  type TransformFnParams,
} from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  icon?: string | null;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
