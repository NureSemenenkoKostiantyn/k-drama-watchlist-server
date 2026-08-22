import { IsIn } from "class-validator";

import { SharedListRole } from "../../../common/types/shared-list.types";

const memberRoles = [
  SharedListRole.Editor,
  SharedListRole.Commenter,
  SharedListRole.Viewer,
] as const;

export class UpdateSharedListMemberDto {
  @IsIn(memberRoles)
  role!: Exclude<SharedListRole, SharedListRole.Owner>;
}
