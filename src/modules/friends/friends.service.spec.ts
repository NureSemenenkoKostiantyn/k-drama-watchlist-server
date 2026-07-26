import { jest } from "@jest/globals";
import { Types } from "mongoose";

import {
  type FriendsRepository,
  type StoredFriendship,
} from "./friends.repository";
import {
  createPairKey,
  FriendsService,
} from "./friends.service";
import {
  type StoredPublicUser,
} from "../users/users.repository";
import { type UsersService } from "../users/users.service";

describe("FriendsService", () => {
  const findAllForUser =
    jest.fn<FriendsRepository["findAllForUser"]>();
  const create = jest.fn<FriendsRepository["create"]>();
  const accept = jest.fn<FriendsRepository["accept"]>();
  const reject = jest.fn<FriendsRepository["reject"]>();
  const deleteForParticipant =
    jest.fn<FriendsRepository["deleteForParticipant"]>();
  const resolveByUsername =
    jest.fn<UsersService["resolveByUsername"]>();
  const findStoredByIds =
    jest.fn<UsersService["findStoredByIds"]>();
  const service = new FriendsService(
    {
      findAllForUser,
      create,
      accept,
      reject,
      deleteForParticipant,
    } as unknown as FriendsRepository,
    {
      resolveByUsername,
      findStoredByIds,
    } as unknown as UsersService,
  );
  const currentUserId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();
  const thirdUserId = new Types.ObjectId();
  const now = new Date("2026-07-26T15:00:00.000Z");
  const otherUser = createUser(
    otherUserId,
    "other_user",
    "Other User",
  );
  const thirdUser = createUser(
    thirdUserId,
    "third_user",
    "Third User",
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a canonical outgoing request without exposing private user data", async () => {
    const friendship = createFriendship({
      requesterId: currentUserId,
      recipientId: otherUserId,
    });
    resolveByUsername.mockResolvedValue(otherUser);
    create.mockResolvedValue(friendship);

    await expect(
      service.request(currentUserId.toHexString(), {
        username: "Other_User",
      }),
    ).resolves.toEqual({
      id: friendship._id.toHexString(),
      status: "pending",
      direction: "outgoing",
      user: {
        id: otherUserId.toHexString(),
        username: "other_user",
        displayUsername: "other_user",
        name: "Other User",
        joinedAt: now.toISOString(),
      },
      createdAt: now.toISOString(),
    });
    expect(create).toHaveBeenCalledWith(
      currentUserId,
      otherUserId,
      createPairKey(currentUserId, otherUserId),
    );
  });

  it("rejects requests targeting the authenticated user", async () => {
    resolveByUsername.mockResolvedValue(
      createUser(currentUserId, "current_user", "Current User"),
    );

    await expect(
      service.request(currentUserId.toHexString(), {
        username: "current_user",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_FRIEND_REQUEST",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("groups accepted, incoming, and outgoing relationships", async () => {
    const accepted = createFriendship({
      requesterId: currentUserId,
      recipientId: otherUserId,
      status: "accepted",
      acceptedAt: now,
    });
    const incoming = createFriendship({
      requesterId: thirdUserId,
      recipientId: currentUserId,
    });
    findAllForUser.mockResolvedValue([accepted, incoming]);
    findStoredByIds.mockResolvedValue([otherUser, thirdUser]);

    await expect(
      service.list(currentUserId.toHexString()),
    ).resolves.toMatchObject({
      friends: [
        {
          id: accepted._id.toHexString(),
          status: "accepted",
          user: { username: "other_user" },
        },
      ],
      incomingRequests: [
        {
          id: incoming._id.toHexString(),
          direction: "incoming",
          user: { username: "third_user" },
        },
      ],
      outgoingRequests: [],
    });
  });

  it("allows only a pending request recipient to accept", async () => {
    const acceptedFriendship = createFriendship({
      requesterId: otherUserId,
      recipientId: currentUserId,
      status: "accepted",
      acceptedAt: now,
    });
    accept.mockResolvedValue(acceptedFriendship);
    findStoredByIds.mockResolvedValue([otherUser]);

    await expect(
      service.accept(
        currentUserId.toHexString(),
        acceptedFriendship._id.toHexString(),
      ),
    ).resolves.toMatchObject({
      status: "accepted",
      direction: "incoming",
      user: { username: "other_user" },
    });
    expect(accept).toHaveBeenCalledWith(
      acceptedFriendship._id,
      currentUserId,
      expect.any(Date),
    );
  });

  it("returns the same not-found response for unauthorized mutations", async () => {
    const friendshipId = new Types.ObjectId();
    reject.mockResolvedValue(false);
    deleteForParticipant.mockResolvedValue(false);

    await expect(
      service.reject(
        currentUserId.toHexString(),
        friendshipId.toHexString(),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.delete(
        currentUserId.toHexString(),
        friendshipId.toHexString(),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("generates one pair key regardless of request direction", () => {
    expect(createPairKey(currentUserId, otherUserId)).toBe(
      createPairKey(otherUserId, currentUserId),
    );
  });
});

function createUser(
  id: Types.ObjectId,
  username: string,
  name: string,
): StoredPublicUser {
  return {
    _id: id,
    username,
    name,
    createdAt: new Date("2026-07-26T15:00:00.000Z"),
  };
}

function createFriendship(
  input: {
    requesterId: Types.ObjectId;
    recipientId: Types.ObjectId;
    status?: "pending" | "accepted";
    acceptedAt?: Date;
  },
): StoredFriendship {
  return {
    _id: new Types.ObjectId(),
    requesterId: input.requesterId,
    recipientId: input.recipientId,
    pairKey: createPairKey(input.requesterId, input.recipientId),
    status: input.status ?? "pending",
    createdAt: new Date("2026-07-26T15:00:00.000Z"),
    ...(input.acceptedAt === undefined
      ? {}
      : { acceptedAt: input.acceptedAt }),
  };
}
