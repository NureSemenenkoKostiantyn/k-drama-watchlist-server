import {
  Transform,
  type TransformFnParams,
  Type,
} from "class-transformer";
import {
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

export class SearchUsersQuery {
  @Transform(trimString)
  @IsString()
  @Length(2, 30)
  @Matches(/^[a-zA-Z0-9_.]+$/)
  q!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
