import "reflect-metadata";

process.env.NODE_ENV = "test";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
process.env.MONGODB_DB_NAME = "drama_watch_test";
process.env.BETTER_AUTH_SECRET = "test-only-secret-with-at-least-32-characters";
process.env.BETTER_AUTH_URL = "http://localhost:8080";
process.env.FRONTEND_URL = "http://localhost:4200";
process.env.TMDB_ACCESS_TOKEN = "test-tmdb-token";
process.env.LOG_LEVEL = "silent";
