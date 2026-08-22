import { IsInt, Min } from "class-validator";

export class SharedListProgressDto {
  @IsInt()
  @Min(0)
  currentSeason!: number;

  @IsInt()
  @Min(0)
  currentEpisode!: number;
}
