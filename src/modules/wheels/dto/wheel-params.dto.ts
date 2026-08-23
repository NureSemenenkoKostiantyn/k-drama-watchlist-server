import { IsMongoId, IsString, Length, Matches } from "class-validator";

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

export class PublicWheelParamsDto {
  @IsString()
  @Length(16, 16)
  @Matches(/^[A-Za-z0-9_-]+$/)
  publicSlug!: string;
}
