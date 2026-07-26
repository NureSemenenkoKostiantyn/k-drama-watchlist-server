import { jest } from "@jest/globals";
import { ObjectId } from "mongodb";

import {
  type StoredPublicUser,
  type UsersRepository,
} from "./users.repository";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const findByUsername =
    jest.fn<UsersRepository["findByUsername"]>();
  const findSearchCandidates =
    jest.fn<UsersRepository["findSearchCandidates"]>();
  const service = new UsersService({
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
    findByUsername.mockResolvedValue(user);

    await expect(
      service.getByUsername("DAHYUN.FAN"),
    ).resolves.toEqual({
      id: user._id.toHexString(),
      username: "dahyun.fan",
      displayUsername: "Dahyun.Fan",
      name: "Dahyun Fan",
      joinedAt: joinedAt.toISOString(),
    });
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

  it("returns a stable not-found error for unknown usernames", async () => {
    findByUsername.mockResolvedValue(null);

    await expect(
      service.getByUsername("missing_user"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
