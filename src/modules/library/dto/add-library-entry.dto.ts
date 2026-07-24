import { Type } from "class-transformer";
import { IsEnum, IsInt, Max, Min } from "class-validator";

import { WatchStatus } from "../../../common/types/library.types";
import { MediaType } from "../../../common/types/media.types";

export class AddLibraryEntryDto {
  @IsEnum(MediaType)
  mediaType!: MediaType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  tmdbId!: number;

  @IsEnum(WatchStatus)
  status: WatchStatus = WatchStatus.ToWatch;
}
