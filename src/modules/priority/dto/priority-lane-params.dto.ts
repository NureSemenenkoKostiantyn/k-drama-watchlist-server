import { IsMongoId } from "class-validator";

export class PriorityLaneParams {
  @IsMongoId()
  laneId!: string;
}
