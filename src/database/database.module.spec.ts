import { ConfigModule } from "@nestjs/config";
import {
  getConnectionToken,
  getModelToken,
  MongooseModule,
} from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import mongoose, { type Connection, type Model } from "mongoose";

import { DatabaseModule } from "./database.module";

interface ExampleDocument {
  title: string;
}

describe("DatabaseModule", () => {
  it("supports feature models on the shared Mongoose connection", async () => {
    const exampleSchema = new mongoose.Schema<ExampleDocument>({
      title: { type: String, required: true },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              MONGODB_URI: "mongodb://127.0.0.1:27017",
              MONGODB_DB_NAME: "drama_watch_test",
            }),
          ],
        }),
        DatabaseModule,
        MongooseModule.forFeature([
          { name: "DatabaseModuleExample", schema: exampleSchema },
        ]),
      ],
    }).compile();

    const connection = moduleRef.get<Connection>(getConnectionToken());
    const model = moduleRef.get<Model<ExampleDocument>>(
      getModelToken("DatabaseModuleExample"),
    );

    expect(model.db).toBe(connection);

    await moduleRef.close();
  });
});
