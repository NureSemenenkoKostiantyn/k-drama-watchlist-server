import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  ValidateNested,
} from "class-validator";

export class PriorityLaneItemOrderDto {
  @IsMongoId()
  laneId!: string;

  @IsArray()
  @ArrayMaxSize(1_000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  itemIds!: string[];
}

export class ReorderPriorityBoardDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PriorityLaneItemOrderDto)
  lanes!: PriorityLaneItemOrderDto[];
}
