import { IsIn } from "class-validator";

import { SharedListRole } from "../../../common/types/shared-list.types";

const inviteRoles = [
  SharedListRole.Editor,
  SharedListRole.Commenter,
  SharedListRole.Viewer,
] as const;

export class CreateSharedListInviteDto {
  @IsIn(inviteRoles)
  role!: Exclude<SharedListRole, SharedListRole.Owner>;
}
