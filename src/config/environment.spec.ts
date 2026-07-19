import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  const secret = "test-only-secret-with-at-least-32-characters";

  it("applies documented defaults", () => {
    expect(
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "mongodb://localhost:27017",
      }),
    ).toEqual({
      NODE_ENV: "development",
      PORT: 8080,
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB_NAME: "drama_watch",
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: "http://localhost:8080",
      FRONTEND_URL: "http://localhost:4200",
      LOG_LEVEL: "info",
    });
  });

  it("coerces a valid port", () => {
    const environment = validateEnvironment({
      BETTER_AUTH_SECRET: secret,
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
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "https://example.com",
      }),
    ).toThrow("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme");
  });

  it("rejects an auth secret shorter than 32 characters", () => {
    expect(() =>
      validateEnvironment({
        BETTER_AUTH_SECRET: "too-short",
        MONGODB_URI: "mongodb://localhost:27017",
      }),
    ).toThrow("BETTER_AUTH_SECRET must be longer than or equal to 32 characters");
  });
});
