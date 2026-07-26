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
import { type SuggestionDocument } from "./schema/suggestion.schema";
import { SuggestionsRepository } from "./suggestions.repository";

describe("SuggestionsRepository transactions", () => {
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

  it("uses a production transaction for acceptance", async () => {
    getOrThrow.mockReturnValue(NodeEnvironment.Production);
    const repository = createRepository();
    const work = jest.fn((activeSession?: ClientSession) => {
      expect(activeSession).toBe(session);
      return Promise.resolve("accepted");
    });

    await expect(repository.runInTransaction(work)).resolves.toBe(
      "accepted",
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("uses the same combined operation without a local transaction", async () => {
    getOrThrow.mockReturnValue(NodeEnvironment.Development);
    const repository = createRepository();
    const work = jest.fn((activeSession?: ClientSession) => {
      expect(activeSession).toBeUndefined();
      return Promise.resolve("accepted");
    });

    await expect(repository.runInTransaction(work)).resolves.toBe(
      "accepted",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  function createRepository(): SuggestionsRepository {
    return new SuggestionsRepository(
      {} as Model<SuggestionDocument>,
      {} as Model<UserMediaDocument>,
      { transaction } as unknown as Connection,
      { getOrThrow } as unknown as ConfigService<Environment, true>,
    );
  }
});
