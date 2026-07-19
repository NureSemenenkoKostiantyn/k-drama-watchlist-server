# Drama Watch API

NestJS backend for Drama Watch, a social watchlist focused on Korean dramas while supporting other television series and films.

This initial foundation provides:

- A strict TypeScript NestJS application.
- `GET /api/health`.
- NestJS `ValidationPipe` request validation with `class-validator` and `class-transformer`, plus the same validation approach for environment configuration.
- Structured Pino request and application logging with sensitive headers redacted.
- A process-wide, lazily opened Mongoose connection.
- A consistent JSON API error shape.
- Jest unit tests and Supertest end-to-end tests.
- A production container image suitable for Google Cloud Run.

Better Auth, TMDB, and domain feature modules are intentionally deferred to later vertical slices.

## Prerequisites

- Node.js 22.14 or newer.
- npm 10 or newer.
- Docker for container builds and container smoke tests.
- A MongoDB connection string when exercising database-backed features. The health endpoint does not connect to MongoDB.

## Local setup

Install dependencies:

```bash
npm install
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Start the development server:

```bash
npm run dev
```

The API listens on `http://localhost:8080` by default. Check it with:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Environment

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `NODE_ENV` | No | `development` | Runtime mode: `development`, `test`, or `production`. |
| `PORT` | No | `8080` | HTTP listen port. |
| `MONGODB_URI` | Yes | — | MongoDB or MongoDB Atlas connection string. |
| `MONGODB_DB_NAME` | No | `drama_watch` | Application database name. |
| `LOG_LEVEL` | No | `info` | Pino log level. |

Do not commit `.env` files or credentials. Add Better Auth and TMDB variables only when those integrations are implemented.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start NestJS in watch mode. |
| `npm run build` | Compile the production application into `dist`. |
| `npm start` | Run the compiled application. |
| `npm run lint` | Run ESLint without modifying files. |
| `npm run typecheck` | Type-check source and tests without emitting files. |
| `npm test` | Run Jest unit tests. |
| `npm run test:watch` | Run unit tests in watch mode. |
| `npm run test:e2e` | Run Supertest against a NestJS application. |

## API errors

Non-success responses use the shared shape documented by the project specification:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found."
  }
}
```

Unexpected errors are logged server-side and returned without stack traces or internal details.

## Mongoose lifecycle

`MongooseDatabaseService` is a singleton NestJS provider backed by the connection token used by `@nestjs/mongoose`. It opens one Mongoose connection per application process only when a database consumer first requests it, shares an in-flight connection attempt, and closes the connection during application shutdown.

Feature modules should register schemas with `MongooseModule.forFeature()`. Better Auth will reuse the native database and client exposed by this same Mongoose connection when authentication is implemented.

## Container

Build the production image:

```bash
docker build -t k-drama-watchlist-server:local .
```

Run it using the local environment file:

```bash
docker run --rm -p 8080:8080 --env-file .env k-drama-watchlist-server:local
```

Cloud Run must provide production environment values through its secret and environment configuration. The application listens on `process.env.PORT` and stores no process-local user state.
