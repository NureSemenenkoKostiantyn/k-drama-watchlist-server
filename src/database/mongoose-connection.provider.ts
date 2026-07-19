import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import mongoose, { type Connection } from "mongoose";

export const mongooseConnectionProvider: Provider<Connection> = {
  provide: getConnectionToken(),
  useFactory: (): Connection => mongoose.createConnection(),
};
