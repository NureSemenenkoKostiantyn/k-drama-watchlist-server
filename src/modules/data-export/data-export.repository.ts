import { Injectable } from "@nestjs/common";
import { ObjectId, type Collection } from "mongodb";

import { MongooseDatabaseService } from "../../database/mongoose-database.service";

export interface StoredExportAccount {
  _id: ObjectId;
  email: string;
  emailVerified: boolean;
  name: string;
  username?: string;
  displayUsername?: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DataExportRepository {
  constructor(
    private readonly databaseService: MongooseDatabaseService,
  ) {}

  async findAccountById(
    userId: ObjectId,
  ): Promise<StoredExportAccount | null> {
    const users = await this.getUsersCollection();
    return users.findOne(
      { _id: userId },
      { projection: accountExportProjection },
    );
  }

  private async getUsersCollection(): Promise<
    Collection<StoredExportAccount>
  > {
    const { database } =
      await this.databaseService.getNativeConnection();
    return database.collection<StoredExportAccount>("user");
  }
}

const accountExportProjection = {
  _id: 1,
  email: 1,
  emailVerified: 1,
  name: 1,
  username: 1,
  displayUsername: 1,
  image: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;
