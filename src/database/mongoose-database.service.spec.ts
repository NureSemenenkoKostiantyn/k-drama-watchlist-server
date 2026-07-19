import { ConfigService } from "@nestjs/config";
import { getConnectionToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { ConnectionStates, createConnection } from "mongoose";

import {
  type Environment,
  NodeEnvironment,
} from "../config/environment";
import { MongooseDatabaseService } from "./mongoose-database.service";

describe("MongooseDatabaseService", () => {
  it("reuses one service and one disconnected Mongoose connection", async () => {
    const environment: Environment = {
      NODE_ENV: NodeEnvironment.Test,
      PORT: 8080,
      MONGODB_URI: "mongodb://127.0.0.1:27017",
      MONGODB_DB_NAME: "drama_watch_test",
      LOG_LEVEL: "silent",
    };
    const connection = createConnection();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MongooseDatabaseService,
        {
          provide: getConnectionToken(),
          useValue: connection,
        },
        {
          provide: ConfigService,
          useValue: new ConfigService<Environment, true>(environment),
        },
      ],
    }).compile();

    const firstService = moduleRef.get(MongooseDatabaseService);
    const secondService = moduleRef.get(MongooseDatabaseService);

    expect(firstService).toBe(secondService);
    expect(firstService.getConnectionInstance()).toBe(connection);
    expect(connection.readyState).toBe(ConnectionStates.disconnected);

    await moduleRef.close();
  });
});
