import { Global, Module } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";

import { mongooseConnectionProvider } from "./mongoose-connection.provider";
import { MongooseDatabaseService } from "./mongoose-database.service";

@Global()
@Module({
  providers: [mongooseConnectionProvider, MongooseDatabaseService],
  exports: [getConnectionToken(), MongooseDatabaseService],
})
export class DatabaseModule {}
