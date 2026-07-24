import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from "class-validator";

export class ReorderPriorityLanesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  laneIds!: string[];
}
