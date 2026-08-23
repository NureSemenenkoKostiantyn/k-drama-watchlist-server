import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class PublicSharedListsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit = 12;
}
