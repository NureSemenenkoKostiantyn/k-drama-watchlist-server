import {
  Transform,
  type TransformFnParams,
  Type,
} from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from "class-validator";

import { WatchStatus } from "../../../common/types/library.types";
import { MediaType } from "../../../common/types/media.types";
import { PublicLibrarySort } from "../../../common/types/public-library.types";

export class PublicLibraryQuery {
  @IsOptional()
  @IsEnum(WatchStatus)
  status?: WatchStatus;

  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  minRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId?: number;

  @IsOptional()
  @Transform(uppercaseString)
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearTo?: number;

  @IsEnum(PublicLibrarySort)
  sort = PublicLibrarySort.RecentlyUpdated;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit = 24;
}

function uppercaseString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.toUpperCase() : value;
}
