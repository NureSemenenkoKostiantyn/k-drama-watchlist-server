import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { trimCommentText } from "./comment-text.transform";

export class UpdateCommentDto {
  @IsOptional()
  @Transform(({ value }) => trimCommentText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  hasSpoiler?: boolean;
}
