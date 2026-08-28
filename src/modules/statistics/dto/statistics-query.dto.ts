import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional } from "class-validator";

import { WatchStatus } from "../../../common/types/library.types";

export class StatisticsQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseStatuses(value as unknown))
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WatchStatus, { each: true })
  statuses?: WatchStatus[];
}

function parseStatuses(value: unknown): unknown {
  return typeof value === "string"
    ? value
        .split(",")
        .map((status) => status.trim())
        .filter(Boolean)
    : value;
}
