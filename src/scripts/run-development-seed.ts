import { MongoClient } from "mongodb";

import {
  assertDevelopmentSeedEnvironment,
  developmentDemoCredentials,
  seedDevelopmentData,
} from "./seed-development";

async function main(): Promise<void> {
  const { mongodbUri, databaseName } =
    assertDevelopmentSeedEnvironment(process.env);
  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();
    await seedDevelopmentData(client.db(databaseName));
    console.log("Development mock data is ready.");
    console.log(`Email: ${developmentDemoCredentials.email}`);
    console.log(`Password: ${developmentDemoCredentials.password}`);
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Development seed failed.",
  );
  process.exitCode = 1;
});
