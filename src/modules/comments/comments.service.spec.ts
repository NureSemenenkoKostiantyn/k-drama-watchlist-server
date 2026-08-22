import { Types } from "mongoose";

import { SharedListRole } from "../../common/types/shared-list.types";
import { type StoredComment } from "./comments.repository";
import { canComment, toCommentResponse } from "./comments.service";

describe("comment policy", () => {
  it("allows collaborative roles to comment while viewers remain read-only", () => {
    expect(canComment(SharedListRole.Owner)).toBe(true);
    expect(canComment(SharedListRole.Editor)).toBe(true);
    expect(canComment(SharedListRole.Commenter)).toBe(true);
    expect(canComment(SharedListRole.Viewer)).toBe(false);
    expect(canComment(null)).toBe(false);
  });

  it("never returns a deleted comment body or spoiler flag", () => {
    const comment: StoredComment = {
      _id: new Types.ObjectId(),
      listId: new Types.ObjectId(),
      listItemId: new Types.ObjectId(),
      authorId: new Types.ObjectId(),
      body: "Private deleted text",
      hasSpoiler: true,
      createdAt: new Date("2026-08-22T10:00:00.000Z"),
      deletedAt: new Date("2026-08-22T11:00:00.000Z"),
    };

    expect(
      toCommentResponse(comment, {
        id: comment.authorId.toHexString(),
        username: "mina",
        displayUsername: "Mina",
        name: "Mina",
        joinedAt: "2026-08-20T10:00:00.000Z",
      }),
    ).toEqual(
      expect.objectContaining({
        id: comment._id.toHexString(),
        isDeleted: true,
        hasSpoiler: false,
        deletedAt: "2026-08-22T11:00:00.000Z",
      }),
    );
    expect(toCommentResponse(comment, {
      id: comment.authorId.toHexString(),
      username: "mina",
      displayUsername: "Mina",
      name: "Mina",
      joinedAt: "2026-08-20T10:00:00.000Z",
    })).not.toHaveProperty("body");
  });
});
