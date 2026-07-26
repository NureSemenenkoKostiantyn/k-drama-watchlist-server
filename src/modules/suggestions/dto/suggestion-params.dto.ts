import { IsMongoId } from "class-validator";

export class SuggestionParamsDto {
  @IsMongoId()
  suggestionId!: string;
}
