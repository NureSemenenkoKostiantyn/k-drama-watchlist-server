# Drama Watch API

NestJS backend for Drama Watch, a social watchlist focused on Korean dramas while supporting other television series and films.

The current backend foundation provides:

- A strict TypeScript NestJS application.
- `GET /api/health`.
- NestJS `ValidationPipe` request validation with `class-validator` and `class-transformer`, plus the same validation approach for environment configuration.
- Structured Pino request and application logging with sensitive headers redacted.
- A process-wide, lazily opened Mongoose connection.
- Better Auth email/password accounts and persistent cookie sessions.
- Username onboarding through Better Auth's username plugin.
- A global NestJS authentication guard, with anonymous routes explicitly marked.
- Better Auth's MongoDB adapter reusing Mongoose's native client and database.
- A consistent JSON API error shape.
- Jest unit tests and Supertest end-to-end tests.
- A production container image suitable for Google Cloud Run.

TMDB and domain feature modules are intentionally deferred to later vertical slices. Email delivery
for verification and password resets remains pending until an email provider is selected.

## Prerequisites

- Node.js 22.22.1 or newer.
- npm 10 or newer.
- Docker for container builds and container smoke tests.
- A MongoDB connection string. Authentication initializes the shared database connection when the application starts.

## Local setup

To run MongoDB, the API, and the Angular client together, use Docker Compose from this repository.
The client repository must be checked out beside it as `../k-drama-watchlist-client`:

```bash
docker compose up --build --watch
```

This requires Docker Compose 2.22 or newer. It builds the `development` target in this repository,
waits for MongoDB to become healthy, serves the API at `http://localhost:8080`, and synchronizes
changes under `src` into the running watch process. Stop the stack with `docker compose down`;
local MongoDB data remains in the `drama-watch_mongodb_data` volume.

To run only the API directly on the host, follow the steps below.

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
| `BETTER_AUTH_SECRET` | Yes | â€” | At least 32 characters; signs and encrypts authentication data. |
| `BETTER_AUTH_URL` | No | `http://localhost:8080` | Public backend origin used by Better Auth. |
| `FRONTEND_URL` | No | `http://localhost:4200` | Trusted frontend origin for authentication requests. |
| `LOG_LEVEL` | No | `info` | Pino log level. |

Do not commit `.env` files or credentials. Add the TMDB token only when that integration is implemented.

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
| `npm run test:e2e` | Run Supertest against a NestJS application and the `drama_watch_test` database. |

Start the Compose MongoDB service before running `npm run test:e2e` from the host. The suite refuses
to clear any database whose name is not exactly `drama_watch_test`.

## Authentication

Better Auth owns routes below `/api/auth/*`. Email/password registration, login, logout, session
persistence, and unique username onboarding are implemented. The integration disables Nest's
default body parser and restores JSON and URL-encoded parsing for ordinary controllers, as required
by `@thallesp/nestjs-better-auth`.

The session token cookie is named exactly `__session` because Firebase Hosting forwards only that
cookie through rewrites to Cloud Run. Better Auth's automatic secure-cookie name prefix is disabled
to preserve this exact name; the `Secure` attribute is still enabled explicitly in production.
Keep these settings together when changing authentication or hosting configuration.

Ordinary API routes are protected by the integration's global guard. Health checks and other
intentionally public endpoints must use `@AllowAnonymous()` explicitly. Controllers must derive the
current user from the authenticated session rather than accepting a user ID as authorization proof.

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

Feature modules should register schemas with `MongooseModule.forFeature()`. Better Auth receives the
native `Db` and `MongoClient` exposed by this same connection; it does not create a second connection.
Adapter transactions are disabled for the standalone local/test MongoDB server and enabled in
production for MongoDB Atlas.

## Container

The Dockerfile includes a dependency-complete development target for the workspace Compose setup
and a minimal non-root runtime target for deployment.

Build the production image:

```bash
docker build -t k-drama-watchlist-server:local .
```

Run it using the local environment file:

```bash
docker run --rm -p 8080:8080 --env-file .env k-drama-watchlist-server:local
```

Cloud Run must provide production environment values through its secret and environment configuration. The application listens on `process.env.PORT` and stores no process-local user state.
