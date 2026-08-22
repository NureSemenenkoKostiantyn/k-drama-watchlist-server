import { Transform, type TransformFnParams } from "class-transformer";
import { IsIn, IsString, Length, Matches } from "class-validator";

import { SharedListRole } from "../../../common/types/shared-list.types";

const inviteRoles = [
  SharedListRole.Editor,
  SharedListRole.Commenter,
  SharedListRole.Viewer,
] as const;

export class CreateSharedListInviteDto {
  @Transform(trimString)
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_.]+$/)
  username!: string;

  @IsIn(inviteRoles)
  role!: Exclude<SharedListRole, SharedListRole.Owner>;
}

function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
