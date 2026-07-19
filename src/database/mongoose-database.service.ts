import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { ConnectionStates, type Connection } from "mongoose";

import { type Environment } from "../config/environment";

@Injectable()
export class MongooseDatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(MongooseDatabaseService.name);
  private connectionPromise?: Promise<Connection>;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  getConnectionInstance(): Connection {
    return this.connection;
  }

  async getConnection(): Promise<Connection> {
    if (this.connection.readyState === ConnectionStates.connected) {
      return this.connection;
    }

    if (this.connection.readyState === ConnectionStates.disconnected) {
      this.connectionPromise = undefined;
    }

    this.connectionPromise ??= this.openConnection();
    return this.connectionPromise;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection.readyState === ConnectionStates.disconnected) {
      return;
    }

    await this.connection.close();
    this.connectionPromise = undefined;
    this.logger.log("Mongoose connection closed");
  }

  private async openConnection(): Promise<Connection> {
    try {
      await this.connection.openUri(
        this.configService.getOrThrow<string>("MONGODB_URI"),
        {
          dbName: this.configService.getOrThrow<string>("MONGODB_DB_NAME"),
        },
      );
      this.logger.log("Mongoose connection established");
      return this.connection;
    } catch (error: unknown) {
      this.connectionPromise = undefined;

      if (this.connection.readyState !== ConnectionStates.disconnected) {
        await this.connection.close().catch(() => undefined);
      }

      throw error;
    }
  }
}
