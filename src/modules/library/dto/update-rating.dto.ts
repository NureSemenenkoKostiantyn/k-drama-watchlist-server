import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

const allowedRatings = Array.from(
  { length: 19 },
  (_value, index) => 1 + index * 0.5,
);

export class UpdateRatingDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsIn(allowedRatings)
  rating!: number | null;
}
