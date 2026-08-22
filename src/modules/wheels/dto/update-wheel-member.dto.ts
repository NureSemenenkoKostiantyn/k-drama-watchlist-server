import { IsIn } from "class-validator";

import { WheelRole } from "../../../common/types/wheel.types";

export class UpdateWheelMemberDto {
  @IsIn([WheelRole.Editor, WheelRole.Viewer])
  role!: WheelRole.Editor | WheelRole.Viewer;
}
