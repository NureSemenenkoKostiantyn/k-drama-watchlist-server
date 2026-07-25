import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateWheelItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
