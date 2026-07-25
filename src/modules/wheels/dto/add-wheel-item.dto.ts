import { IsInt, IsMongoId, IsOptional, Max, Min } from "class-validator";

export class AddWheelItemDto {
  @IsMongoId()
  mediaId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;
}
