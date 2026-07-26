import {
  Transform,
  type TransformFnParams,
} from "class-transformer";
import { IsString, Length, Matches } from "class-validator";

export class CreateFriendRequestDto {
  @Transform(trimString)
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_.]+$/)
  username!: string;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
