import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { trimCommentText } from "./comment-text.transform";

export class CreateCommentDto {
  @Transform(({ value }) => trimCommentText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  hasSpoiler?: boolean;

  @IsOptional()
  @IsMongoId()
  parentCommentId?: string;
}
