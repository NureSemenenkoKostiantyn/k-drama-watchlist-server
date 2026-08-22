import {
  Transform,
  type TransformFnParams,
} from "class-transformer";
import { IsIn, IsString, Length } from "class-validator";

import { WheelRole } from "../../../common/types/wheel.types";

export class AddWheelMemberDto {
  @Transform(trimString)
  @IsString()
  @Length(3, 30)
  username!: string;

  @IsIn([WheelRole.Editor, WheelRole.Viewer])
  role!: WheelRole.Editor | WheelRole.Viewer;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
