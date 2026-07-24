import { IsEnum } from "class-validator";

import { WatchStatus } from "../../../common/types/library.types";

export class UpdateLibraryStatusDto {
  @IsEnum(WatchStatus)
  status!: WatchStatus;
}
