import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { createConnection, type Connection } from "mongoose";

export const mongooseConnectionProvider: Provider<Connection> = {
  provide: getConnectionToken(),
  useFactory: (): Connection => createConnection(),
};
