import {
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateLibraryEntryDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(5_000)
  description!: string | null;
}
