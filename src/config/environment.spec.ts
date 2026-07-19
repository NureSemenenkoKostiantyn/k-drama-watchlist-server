import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  it("applies documented defaults", () => {
    expect(
      validateEnvironment({ MONGODB_URI: "mongodb://localhost:27017" }),
    ).toEqual({
      NODE_ENV: "development",
      PORT: 8080,
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB_NAME: "drama_watch",
      LOG_LEVEL: "info",
    });
  });

  it("coerces a valid port", () => {
    const environment = validateEnvironment({
      MONGODB_URI: "mongodb+srv://example.invalid/drama_watch",
      PORT: "9090",
    });

    expect(environment.PORT).toBe(9090);
  });

  it("rejects a missing MongoDB URI", () => {
    expect(() => validateEnvironment({})).toThrow(
      "Environment validation failed",
    );
  });

  it("rejects an unsupported MongoDB URI scheme", () => {
    expect(() =>
      validateEnvironment({ MONGODB_URI: "https://example.com" }),
    ).toThrow("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme");
  });
});
