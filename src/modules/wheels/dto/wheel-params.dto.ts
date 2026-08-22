import { IsMongoId } from "class-validator";

export class WheelParamsDto {
  @IsMongoId()
  wheelId!: string;
}

export class WheelItemParamsDto extends WheelParamsDto {
  @IsMongoId()
  itemId!: string;
}

export class WheelMemberParamsDto extends WheelParamsDto {
  @IsMongoId()
  memberUserId!: string;
}
