import {
  assertDevelopmentSeedEnvironment,
  developmentDemoCredentials,
} from "./seed-development";

describe("development seed safety", () => {
  it("allows only the local Compose development database", () => {
    expect(
      assertDevelopmentSeedEnvironment({
        NODE_ENV: "development",
        MONGODB_URI: "mongodb://mongodb:27017/drama_watch",
        MONGODB_DB_NAME: "drama_watch",
      }),
    ).toEqual({
      mongodbUri: "mongodb://mongodb:27017/drama_watch",
      databaseName: "drama_watch",
    });
  });

  it("refuses production and Atlas targets", () => {
    expect(() =>
      assertDevelopmentSeedEnvironment({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://localhost:27017/drama_watch",
        MONGODB_DB_NAME: "drama_watch",
      }),
    ).toThrow("NODE_ENV must be development");

    expect(() =>
      assertDevelopmentSeedEnvironment({
        NODE_ENV: "development",
        MONGODB_URI:
          "mongodb+srv://example.mongodb.net/drama_watch",
        MONGODB_DB_NAME: "drama_watch",
      }),
    ).toThrow("local or Compose hostname");
  });

  it("uses clearly local demo credentials", () => {
    expect(developmentDemoCredentials.email).toMatch(
      /@drama-watch\.local$/,
    );
    expect(developmentDemoCredentials.password.length).toBeGreaterThanOrEqual(
      12,
    );
  });
});
