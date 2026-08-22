import { Types } from "mongoose";

import {
  SharedListRole,
  SharedListVisibility,
} from "../../common/types/shared-list.types";
import { type StoredSharedList } from "./shared-lists.repository";
import { sharedListRoleForUser } from "./shared-lists.service";

describe("sharedListRoleForUser", () => {
  it("keeps the owner authoritative and resolves every shared role", () => {
    const ownerId = new Types.ObjectId();
    const editorId = new Types.ObjectId();
    const commenterId = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const outsiderId = new Types.ObjectId();
    const now = new Date("2026-08-22T12:00:00.000Z");
    const list: StoredSharedList = {
      _id: new Types.ObjectId(),
      ownerId,
      title: "Friday dramas",
      visibility: SharedListVisibility.Private,
      members: [
        { userId: ownerId, role: SharedListRole.Viewer, joinedAt: now },
        { userId: editorId, role: SharedListRole.Editor, joinedAt: now },
        {
          userId: commenterId,
          role: SharedListRole.Commenter,
          joinedAt: now,
        },
        { userId: viewerId, role: SharedListRole.Viewer, joinedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    };

    expect(sharedListRoleForUser(list, ownerId)).toBe(SharedListRole.Owner);
    expect(sharedListRoleForUser(list, editorId)).toBe(SharedListRole.Editor);
    expect(sharedListRoleForUser(list, commenterId)).toBe(
      SharedListRole.Commenter,
    );
    expect(sharedListRoleForUser(list, viewerId)).toBe(SharedListRole.Viewer);
    expect(sharedListRoleForUser(list, outsiderId)).toBeNull();
  });
});
