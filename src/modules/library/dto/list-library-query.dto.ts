import { IsEnum, IsOptional } from "class-validator";

import { WatchStatus } from "../../../common/types/library.types";

export class ListLibraryQuery {
  @IsOptional()
  @IsEnum(WatchStatus)
  status?: WatchStatus;
}
