import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  currentSeason!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  currentEpisode!: number;

  @IsOptional()
  @IsBoolean()
  includeSpecials?: boolean;
}
