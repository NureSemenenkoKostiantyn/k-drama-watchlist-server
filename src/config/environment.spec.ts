import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  const secret = "test-only-secret-with-at-least-32-characters";
  const email = {
    EMAIL_FROM: "Drama Watch <auth@example.com>",
    RESEND_API_KEY: "re_test-only-key",
  };

  it("applies documented defaults", () => {
    expect(
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "mongodb://localhost:27017",
        TMDB_ACCESS_TOKEN: "test-tmdb-token",
        ...email,
      }),
    ).toEqual({
      NODE_ENV: "development",
      PORT: 8080,
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB_NAME: "drama_watch",
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: "http://localhost:8080",
      FRONTEND_URL: "http://localhost:4200",
      TMDB_ACCESS_TOKEN: "test-tmdb-token",
      RESEND_API_KEY: "re_test-only-key",
      EMAIL_FROM: "Drama Watch <auth@example.com>",
      RATE_LIMIT_TTL_MS: 60_000,
      RATE_LIMIT_MAX: 120,
      LOG_LEVEL: "info",
      TELEGRAM_ENABLED: false,
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_BOT_USERNAME: "",
      TELEGRAM_WEBHOOK_SECRET: "",
      TELEGRAM_MINI_APP_URL: "http://localhost:4200/telegram",
      TELEGRAM_LINK_TTL_MINUTES: 10,
    });
  });

  it("coerces a valid port", () => {
    const environment = validateEnvironment({
      BETTER_AUTH_SECRET: secret,
      MONGODB_URI: "mongodb+srv://example.invalid/drama_watch",
      PORT: "9090",
      TMDB_ACCESS_TOKEN: "test-tmdb-token",
      ...email,
    });

    expect(environment.PORT).toBe(9090);
  });

  it("coerces valid rate-limit settings", () => {
    const environment = validateEnvironment({
      BETTER_AUTH_SECRET: secret,
      MONGODB_URI: "mongodb://localhost:27017",
      TMDB_ACCESS_TOKEN: "test-tmdb-token",
      RATE_LIMIT_TTL_MS: "30000",
      RATE_LIMIT_MAX: "80",
      ...email,
    });

    expect(environment.RATE_LIMIT_TTL_MS).toBe(30_000);
    expect(environment.RATE_LIMIT_MAX).toBe(80);
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
        TMDB_ACCESS_TOKEN: "test-tmdb-token",
        ...email,
      }),
    ).toThrow("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme");
  });

  it("rejects an auth secret shorter than 32 characters", () => {
    expect(() =>
      validateEnvironment({
        BETTER_AUTH_SECRET: "too-short",
        MONGODB_URI: "mongodb://localhost:27017",
        TMDB_ACCESS_TOKEN: "test-tmdb-token",
        ...email,
      }),
    ).toThrow("BETTER_AUTH_SECRET must be longer than or equal to 32 characters");
  });

  it("rejects a missing TMDB access token", () => {
    expect(() =>
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "mongodb://localhost:27017",
        ...email,
      }),
    ).toThrow("TMDB_ACCESS_TOKEN must be a string");
  });

  it("rejects missing transactional email configuration", () => {
    expect(() =>
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "mongodb://localhost:27017",
        TMDB_ACCESS_TOKEN: "test-tmdb-token",
      }),
    ).toThrow("RESEND_API_KEY must be a string");
  });

  it("requires Telegram credentials only when the integration is enabled", () => {
    expect(() =>
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "mongodb://localhost:27017",
        TMDB_ACCESS_TOKEN: "test-tmdb-token",
        TELEGRAM_ENABLED: "true",
        ...email,
      }),
    ).toThrow("TELEGRAM_BOT_TOKEN must be a Telegram bot token");

    expect(
      validateEnvironment({
        BETTER_AUTH_SECRET: secret,
        MONGODB_URI: "mongodb://localhost:27017",
        TMDB_ACCESS_TOKEN: "test-tmdb-token",
        TELEGRAM_ENABLED: "true",
        TELEGRAM_BOT_TOKEN: "123456:telegram-test-token",
        TELEGRAM_BOT_USERNAME: "DramaWatchBot",
        TELEGRAM_WEBHOOK_SECRET:
          "telegram_webhook_secret_with_32_chars",
        TELEGRAM_MINI_APP_URL: "https://example.com/telegram",
        ...email,
      }).TELEGRAM_ENABLED,
    ).toBe(true);
  });
});
