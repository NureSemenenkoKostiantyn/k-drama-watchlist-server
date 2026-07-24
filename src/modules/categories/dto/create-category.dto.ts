import {
  Transform,
  type TransformFnParams,
} from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

export class CreateCategoryDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  icon?: string;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
