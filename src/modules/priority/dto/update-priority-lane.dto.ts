import {
  Transform,
  type TransformFnParams,
} from "class-transformer";
import { IsString, Length } from "class-validator";

export class UpdatePriorityLaneDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  name!: string;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
