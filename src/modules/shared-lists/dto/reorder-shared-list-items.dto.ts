import { ArrayUnique, IsArray, IsMongoId } from "class-validator";

export class ReorderSharedListItemsDto {
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  itemIds!: string[];
}
