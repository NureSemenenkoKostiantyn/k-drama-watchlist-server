import { jest } from "@jest/globals";
import { ObjectId } from "mongodb";

import {
  type StoredPublicUser,
  type UsersRepository,
} from "./users.repository";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const findById = jest.fn<UsersRepository["findById"]>();
  const findByUsername =
    jest.fn<UsersRepository["findByUsername"]>();
  const findSearchCandidates =
    jest.fn<UsersRepository["findSearchCandidates"]>();
  const service = new UsersService({
    findById,
    findByUsername,
    findSearchCandidates,
  } as unknown as UsersRepository);
  const authenticatedUserId = new ObjectId();
  const joinedAt = new Date("2026-07-20T10:00:00.000Z");
  const user: StoredPublicUser = {
    _id: new ObjectId(),
    name: "Dahyun Fan",
    username: "dahyun.fan",
    displayUsername: "Dahyun.Fan",
    createdAt: joinedAt,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only the public profile contract", async () => {
    findById.mockResolvedValue(user);

    await expect(
      service.getById(user._id.toHexString()),
    ).resolves.toEqual({
      id: user._id.toHexString(),
      username: "dahyun.fan",
      displayUsername: "Dahyun.Fan",
      name: "Dahyun Fan",
      joinedAt: joinedAt.toISOString(),
    });
    expect(findById).toHaveBeenCalledWith(user._id);
  });

  it("continues resolving usernames for username-targeted actions", async () => {
    findByUsername.mockResolvedValue(user);

    await expect(service.resolveByUsername("DAHYUN.FAN")).resolves.toBe(user);
    expect(findByUsername).toHaveBeenCalledWith("dahyun.fan");
  });

  it("returns ranked public search results with match context", async () => {
    findSearchCandidates.mockResolvedValue([user]);

    await expect(
      service.search(
        authenticatedUserId.toHexString(),
        "Dahyun",
        10,
      ),
    ).resolves.toEqual([
      {
        id: user._id.toHexString(),
        username: "dahyun.fan",
        displayUsername: "Dahyun.Fan",
        name: "Dahyun Fan",
        joinedAt: joinedAt.toISOString(),
      },
    ]);
    expect(findSearchCandidates).toHaveBeenCalledWith(
      "Dahyun",
      authenticatedUserId,
      500,
    );
  });

  it("returns a stable not-found error for unknown user IDs", async () => {
    findById.mockResolvedValue(null);

    await expect(
      service.getById(new ObjectId().toHexString()),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
