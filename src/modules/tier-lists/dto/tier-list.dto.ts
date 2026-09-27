import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { MediaType } from "../../../common/types/media.types";
import {
  TierColor,
  TierListVisibility,
} from "../../../common/types/tier-list.types";

export class RevisionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER - 1)
  revision!: number;
}

export class CreateTierListDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateTierListDto extends RevisionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsEnum(TierListVisibility)
  visibility!: TierListVisibility;
}

export class TierPlacementDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  id!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  @IsEnum(TierColor)
  color!: TierColor;

  @IsArray()
  @ArrayMaxSize(300)
  @ArrayUnique()
  @Matches(/^(tv|movie):[1-9]\d{0,14}$/, { each: true })
  mediaIds!: string[];
}

export class UpdateTierLayoutDto extends RevisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TierPlacementDto)
  tiers!: TierPlacementDto[];

  @IsArray()
  @ArrayMaxSize(300)
  @ArrayUnique()
  @Matches(/^(tv|movie):[1-9]\d{0,14}$/, { each: true })
  unrankedMediaIds!: string[];
}

export class TierMediaIdentityDto {
  @IsEnum(MediaType)
  mediaType!: MediaType;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  tmdbId!: number;
}

export class AddTierItemsDto extends RevisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TierMediaIdentityDto)
  items!: TierMediaIdentityDto[];
}

export class RemoveTierItemDto extends RevisionDto {
  @IsString()
  @Matches(/^(tv|movie):[1-9]\d{0,14}$/)
  mediaId!: string;
}

export class TierListParamsDto {
  @IsMongoId()
  tierListId!: string;
}

export class PublicTierListParamsDto {
  @Matches(/^[a-zA-Z0-9_-]{16}$/)
  publicSlug!: string;
}
