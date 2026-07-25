import {
  ArrayUnique,
  IsArray,
  IsMongoId,
} from "class-validator";

export class ReorderWheelItemsDto {
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  itemIds!: string[];
}
