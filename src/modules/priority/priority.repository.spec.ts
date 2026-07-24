import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import {
  type ClientSession,
  type Connection,
  type Model,
} from "mongoose";

import {
  type Environment,
  NodeEnvironment,
} from "../../config/environment";
import { type UserMediaDocument } from "../library/schema/user-media.schema";
import { PriorityRepository } from "./priority.repository";
import { type PriorityLaneDocument } from "./schema/priority-lane.schema";

describe("PriorityRepository transactions", () => {
  const session = {} as ClientSession;
  const transaction = jest.fn(
    async (
      work: (activeSession: ClientSession) => Promise<string>,
    ): Promise<string> => work(session),
  );
  const getOrThrow = jest.fn<
    ConfigService<Environment, true>["getOrThrow"]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs priority-board changes in a production transaction", async () => {
    getOrThrow.mockReturnValue(NodeEnvironment.Production);
    const repository = createRepository();
    const work = jest.fn((activeSession?: ClientSession) => {
      expect(activeSession).toBe(session);
      return Promise.resolve("committed");
    });

    await expect(repository.runInTransaction(work)).resolves.toBe(
      "committed",
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("uses the combined operation without a local transaction", async () => {
    getOrThrow.mockReturnValue(NodeEnvironment.Development);
    const repository = createRepository();
    const work = jest.fn((activeSession?: ClientSession) => {
      expect(activeSession).toBeUndefined();
      return Promise.resolve("saved");
    });

    await expect(repository.runInTransaction(work)).resolves.toBe(
      "saved",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  function createRepository(): PriorityRepository {
    return new PriorityRepository(
      {} as Model<PriorityLaneDocument>,
      {} as Model<UserMediaDocument>,
      { transaction } as unknown as Connection,
      { getOrThrow } as unknown as ConfigService<Environment, true>,
    );
  }
});
