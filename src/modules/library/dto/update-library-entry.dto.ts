import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateLibraryEntryDto {
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(5_000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  categoryIds?: string[];
}
