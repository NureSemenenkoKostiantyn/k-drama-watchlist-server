# Drama Watch API

NestJS backend for Drama Watch, a social watchlist focused on Korean dramas while supporting other television series and films.

The current backend foundation provides:

- A strict TypeScript NestJS application.
- `GET /api/health`.
- NestJS `ValidationPipe` request validation with `class-validator` and `class-transformer`, plus the same validation approach for environment configuration.
- Structured Pino request and application logging with sensitive headers redacted.
- A process-wide, lazily opened Mongoose connection.
- Better Auth email/password accounts, verified email addresses, password resets, and persistent
  cookie sessions.
- Username onboarding through Better Auth's username plugin.
- A global NestJS authentication guard, with anonymous routes explicitly marked.
- Better Auth's MongoDB adapter reusing Mongoose's native client and database.
- Protected TMDB text search and normalized TV/movie detail endpoints.
- An anonymous K-drama discovery feed with 24-hour MongoDB shelf caching and stale fallback.
- Global NestJS request throttling with a tighter per-user TMDB search limit.
- A personal library API backed by one shared media snapshot per TMDB title and separate
  owner-scoped user relationships.
- Personal-library responses enriched with accepted-suggestion provenance and the current user's
  accessible shared-list memberships for relationship-aware filtering.
- Owner-scoped episode progress, half-point ratings, private descriptions, and audio/subtitle
  preferences.
- Owner-scoped custom category CRUD and multi-category assignment for personal library entries.
- Owner-scoped priority lanes with complete-array lane and to-watch item ordering.
- Shared wheels with owner, editor, and viewer roles, weighted candidates, server-side selection,
  attributed spin history, and revocable public or unlisted read-only links.
- Shared lists with targeted one-time role invitations, ordered shared-media items, notes, group
  lifecycle state, group progress, and revocable public or unlisted read-only links.
- Plain-text shared-list comments with replies, spoiler flags, soft deletion, and comment/reply
  notifications.
- Owner-only shared-list member role/removal controls and list-linked shared-item-update
  notifications.
- Target-owned shared-list invitation notifications with secure token and in-app acceptance paths.
- Public user profiles and protected weighted name/username discovery without exposing email
  addresses.
- Friend-only title suggestions with transactional acceptance into the recipient's library.
- Persistent social notifications with owner-scoped read state and unread counts.
- Accepted-friend media context with public status and rating projections.
- Reusable user settings with private-by-default library visibility.
- Paginated friend libraries with server-enforced private, friends-only, and public access.
- A consistent JSON API error shape.
- Jest unit tests and Supertest end-to-end tests.
- A production container image suitable for Google Cloud Run.

Public profiles, username discovery, friendship management, friend suggestions, notifications, safe
friend context, reusable settings, visibility-controlled friend libraries, and accepted-friend
wheel sharing, shared lists, shared-list discussions, member management, and public-safe list and
wheel links are implemented.
Authentication emails are delivered through Resend.

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

Populate the local database with repeatable demo data after the stack is running:

```bash
docker compose exec api npm run seed:dev
```

The seed creates the verified demo account `demo@drama-watch.local` with password
`DramaWatch1!`, three example friendship states, received and sent suggestions, social
notifications, four shared media records, a personal library, accepted-friend media activity,
friends-only demo visibility settings, categories, default priority lanes, and owned and shared
wheels with example spin history, and owned and read-only shared lists with group progress and
spoiler-marked discussion. It uses upserts,
does not clear existing records, and is never run automatically. The command refuses to run unless
`NODE_ENV=development`, the database is the local `drama_watch` database, and MongoDB is reached
through a loopback or Compose hostname; it cannot target MongoDB Atlas.

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
| `TMDB_ACCESS_TOKEN` | Yes | — | TMDB API Read Access Token used only by the backend. |
| `RESEND_API_KEY` | Yes | — | Resend API key used only by the backend for authentication email delivery. |
| `EMAIL_FROM` | Yes | — | Verified sender, such as `Drama Watch <auth@dahyun.best>`. |
| `RATE_LIMIT_TTL_MS` | No | `60000` | Default request-rate window in milliseconds. |
| `RATE_LIMIT_MAX` | No | `120` | Default maximum requests per route and tracker in one window. |
| `LOG_LEVEL` | No | `info` | Pino log level. |

Do not commit `.env` files or credentials. Set `TMDB_ACCESS_TOKEN`, `RESEND_API_KEY`, and
`EMAIL_FROM` in the local `.env` file when testing complete authentication flows. Provide API keys
to Cloud Run through Secret Manager or equivalent deployment configuration. `EMAIL_FROM` must use
a sender accepted by the configured Resend account.

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
| `npm run seed:dev` | Build and upsert guarded mock data into the local development database. |

Start the Compose MongoDB service before running `npm run test:e2e` from the host. The suite refuses
to clear any database whose name is not exactly `drama_watch_test`.

## Authentication

Better Auth owns routes below `/api/auth/*`. Email/password registration, email verification,
login, logout, password reset, session persistence, and unique username onboarding are
implemented. Registration requires verification before login. Verification and reset links expire
after one hour, and a successful password reset revokes existing sessions. Resend delivery is
isolated behind the authentication email service so provider failures do not expose credentials,
tokens, or recipient details.

The integration disables Nest's default body parser and restores JSON and URL-encoded parsing for
ordinary controllers, as required by `@thallesp/nestjs-better-auth`.

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

Feature modules expose their Mongoose models through NestJS providers backed by the same connection
token. Better Auth receives the native `Db` and `MongoClient` exposed by this connection; it does not
create a second connection. Adapter transactions are disabled for the standalone local/test MongoDB
server and enabled in production for MongoDB Atlas.

## TMDB integration

Authenticated users can search TMDB through `GET /api/search` and retrieve normalized details through
`GET /api/media/:mediaType/:tmdbId`. The browser never receives the TMDB access token or calls TMDB
directly.

Detail normalization groups TMDB production states into `airing`, `upcoming`, `ended`, or `unknown`
for consistent TV and movie filtering. `POST /api/media/:mediaType/:tmdbId/refresh` fetches current
details and updates the shared media snapshot. Older snapshots without this field remain valid and
resolve to `unknown` in the library interface until refreshed; reusing one while adding a title also
backfills it automatically.

Search supports a required `q` value, `type=all|tv|movie`, and one-based `page`. A two-letter
`country` filter is available for TV searches; the K-drama UI uses `type=tv&country=KR`. Search
responses omit person results, expose stable `tv:<tmdbId>` or `movie:<tmdbId>` identities, and retain
both TMDB image paths and generated image URLs.

The non-personal `GET /api/discovery/home` endpoint powers the K-drama portal. It returns a featured
title and five shelves: popular K-dramas, currently airing K-dramas, top-rated K-dramas with at
least 200 TMDB votes, K-dramas released within the last 90 days, and popular movies. The endpoint is
intentionally anonymous and sends a one-hour public HTTP cache policy.

Each shelf is normalized and cached independently in the `discoveryCache` MongoDB collection for
24 hours. Cache documents remain for seven days so stale content can be served when TMDB fails.
A short refresh lease prevents Cloud Run instances from routinely refreshing the same expired
shelf concurrently. The TTL index deletes abandoned cache documents after their fallback window.

TMDB search is limited to 20 requests per minute per authenticated Better Auth user. The global
throttler also uses authenticated user IDs where available. Its unauthenticated fallback uses the
direct socket address and deliberately ignores forwarded headers supplied through Firebase Hosting
and Cloud Run.

## Public profiles

`GET /api/users/:userId` is public and returns the user's ID, username, display username, public
name, optional image, and join date. Email addresses and Better Auth internals are never returned.
Authenticated users can call `GET /api/users/search?q=<query>&limit=<1-20>` to search normalized
usernames and public names. Results rank exact usernames, username prefixes, exact names, name-word
prefixes, substrings, and bounded typo-tolerant matches in that order. Punctuation, casing, and
accents are normalized before scoring. The current user is excluded, and email addresses are never
searched or returned. Candidate retrieval is capped before in-process similarity scoring to keep
each request bounded.

## User settings and shared libraries

Authenticated users manage reusable application settings through:

```text
GET   /api/settings
PATCH /api/settings
```

The first setting is `libraryVisibility`, with `private`, `friends`, and `public` values. Missing
settings resolve to `private` without writing a document. Updates use one `userSettings` document
per Better Auth user, enforced by a unique `userId` index.

Libraries are browsed through:

```text
GET /api/users/:userId/library
```

Owners always have access. Friends-only libraries require an accepted friendship, while public
libraries support anonymous viewing. Results are paginated and can filter lifecycle status, media
type, minimum rating, genre, country, and an inclusive release-year range. Sorting supports recent
activity, title in either direction, highest rating, and release date in either direction. The
response contains only normalized shared media, status, and optional rating; it never returns
private notes, progress, categories, priority data, playback preferences, suggestion provenance,
lifecycle timestamps, or personal-entry IDs.

## Friendships

Authenticated users can manage friendships through:

```text
GET    /api/friends
POST   /api/friends/request
POST   /api/friends/:friendshipId/accept
POST   /api/friends/:friendshipId/reject
DELETE /api/friends/:friendshipId
GET    /api/media/:mediaType/:tmdbId/friend-context
```

The list response separates accepted friends, requests received by the current user, and requests
sent by the current user. Requests target a normalized username. Only the recipient can accept or
reject a pending request, while either participant can remove an accepted friendship or cancel a
pending request. All authorization comes from the Better Auth session.

Each friendship stores a canonical pair key with a unique index. This prevents both duplicate and
reversed duplicate relationships even when two users send requests concurrently. Friendship
responses include only the public user profile contract and never expose email addresses.

Media friend context includes only accepted friends who have the shared title in their library. It
returns the public profile, lifecycle status, and optional half-point rating. Private descriptions,
progress, categories, playback preferences, and every other personal-library field are never
included.

## Suggestions

Authenticated users can manage recommendations through:

```text
GET  /api/suggestions
POST /api/suggestions
POST /api/suggestions/:suggestionId/accept
POST /api/suggestions/:suggestionId/dismiss
```

A suggestion targets an accepted friend by username and identifies a title by TMDB media type and
ID. The backend resolves or creates the one shared media snapshot before storing its ObjectId.
Resending the same title while its suggestion is pending replaces the existing message instead of
creating a duplicate card. Sending it again after acceptance or dismissal creates a new history
entry. Listing returns separate received and sent arrays with public user data and normalized media
details.

Only the recipient can accept or dismiss a pending suggestion. Acceptance creates a `to_watch`
entry only when the title is absent, preserves every field of an existing personal entry, and marks
the suggestion accepted. Those writes run in one transaction on production MongoDB Atlas; local and
test MongoDB execute the same combined operation without a transaction. Dismissal never changes the
library.

## Notifications

Authenticated users can manage their notification feed through:

```text
GET  /api/notifications
POST /api/notifications/:notificationId/read
POST /api/notifications/read-all
```

The feed returns the 50 most recent owner-scoped notifications, their public actor profiles, and a
complete unread count. Friend requests, accepted friend requests, and received title suggestions
create notifications. Resending a pending suggestion refreshes its existing notification and marks
it unread instead of creating duplicates. A user cannot read another user's notification.

Notification publishing is secondary to the social action: a delivery failure is logged but does
not turn an already-created friendship or suggestion into a failed API response.

## Personal library

Authenticated users can manage their personal relationship with a title through:

```text
GET    /api/library
POST   /api/library
GET    /api/library/:entryId
PATCH  /api/library/:entryId
PATCH  /api/library/:entryId/status
PATCH  /api/library/:entryId/progress
PATCH  /api/library/:entryId/rating
PATCH  /api/library/:entryId/playback-preference
DELETE /api/library/:entryId
```

The `media` collection has one unique document for each `{ mediaType, tmdbId }` pair. The first user
to add a title causes the API to fetch and store its normalized TMDB details. Later users reuse that
document's ObjectId through their own `userMedia` documents, so posters, titles, seasons, and other
metadata are not duplicated per user. Removing a personal entry never deletes the shared media
snapshot.

All library queries are scoped with the Better Auth session user ID. A client-supplied user ID is
never accepted as authorization evidence. A unique `{ userId, mediaId }` index prevents duplicate
personal entries. TV progress is validated against the stored season snapshot, excludes specials
by default, and automatically moves an entry between `to_watch`, `watching`, and `watched` as its
completed episode count changes. Ratings accept half-point values from 1 through 10; descriptions
remain private and are limited to 5,000 characters. The generic library update endpoint also accepts
an ordered, duplicate-free array of category IDs and verifies that every category belongs to the
authenticated user.

Library responses expose a suggestion source only when the entry was created by accepting a friend
suggestion, using that sender's public profile projection. They also include compact ID/title
references only for shared lists the authenticated user currently owns or belongs to. These fields
support client-side relationship filters without exposing unrelated lists or private user data.

## Categories

Authenticated users can manage custom categories through:

```text
GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:categoryId
DELETE /api/categories/:categoryId
```

Names produce owner-scoped Unicode slugs and must contain at least one letter or number. Category
names are unique per user after slug normalization. Deleting a category removes its ID from every
personal library entry owned by that user.

## Priority board

Authenticated users can manage priority lanes through:

```text
GET    /api/priority-lanes
POST   /api/priority-lanes
PATCH  /api/priority-lanes/:laneId
DELETE /api/priority-lanes/:laneId
POST   /api/priority-lanes/reorder
POST   /api/priority-lanes/reorder-items
```

The first read lazily provisions the four documented default lanes. Reorder operations accept the
complete ordered lane or item ID array, reject duplicates and foreign resources, and allow only
owner-scoped `to_watch` entries. Moving an entry out of `to_watch` or deleting its lane clears both
priority fields. Item moves submit every affected lane in one request. MongoDB Atlas applies the
validation and complete affected-lane replacement in one transaction; the standalone local/test
database uses the same combined operation without transactions.

## Private and shared wheels

Authenticated users can manage owned and accepted-friend shared wheels through:

```text
GET    /api/wheels
POST   /api/wheels
GET    /api/wheels/:wheelId
PATCH  /api/wheels/:wheelId
DELETE /api/wheels/:wheelId
GET    /api/public/wheels/:publicSlug

POST   /api/wheels/:wheelId/items
PATCH  /api/wheels/:wheelId/items/:itemId
DELETE /api/wheels/:wheelId/items/:itemId
POST   /api/wheels/:wheelId/reorder

POST   /api/wheels/:wheelId/spin
GET    /api/wheels/:wheelId/history
POST   /api/wheels/:wheelId/reset-history

POST   /api/wheels/:wheelId/members
PATCH  /api/wheels/:wheelId/members/:memberUserId
DELETE /api/wheels/:wheelId/members/:memberUserId
```

Wheel items reuse shared media snapshots and support weights from 1 through 100 plus an enabled
state. The backend selects every winner. Fully random mode respects candidate weights; avoid-recent
mode removes the most recently selected candidate when another enabled option exists. Production
spin and history-reset writes use MongoDB Atlas transactions. Owners may share a wheel directly
with accepted friends as viewers or editors. Editors can add, change, remove, and reorder candidates
and can spin; viewers can inspect candidates and attributed shared history. Only owners can change
wheel settings, manage members, reset history, or delete the wheel. Public and unlisted wheel links
use a stable random slug while enabled and are revoked by switching back to private. The anonymous
projection includes public-safe candidates, members, and attributed history without internal wheel,
candidate, spin, or MongoDB media IDs. Anonymous viewers cannot spin or mutate a wheel.

## Shared lists

Authenticated users can create lists and access lists shared with them through:

```text
GET    /api/lists
POST   /api/lists
GET    /api/lists/:listId
PATCH  /api/lists/:listId
DELETE /api/lists/:listId
GET    /api/public/lists
GET    /api/public/lists/:publicSlug

POST   /api/lists/:listId/items
PATCH  /api/lists/:listId/items/:itemId
DELETE /api/lists/:listId/items/:itemId
POST   /api/lists/:listId/reorder

POST   /api/lists/:listId/invites
PATCH  /api/lists/:listId/members/:memberUserId
DELETE /api/lists/:listId/members/:memberUserId
POST   /api/list-invites/:token/accept
```

Owners create seven-day, one-time invitation links for an exact registered username with editor,
commenter, or viewer access. Only a SHA-256 token hash is persisted, and only the target may accept
through the token link or in-app invitation notification. Resending refreshes the pending invitation
and notification. Owners and editors may add shared media snapshots, reorder every
item as a complete array, and update shared notes, group status, and group progress. Commenters and
viewers cannot edit shared items. Owners, editors, and commenters may post plain-text comments and
one-level replies; viewers can read them. Spoilers remain hidden until explicitly revealed. Authors
may edit or soft-delete their own comments, while list owners may moderate by soft-deleting any
comment. Comment and reply notifications link back to the list. Only owners can rename or delete a
list, create invitations, change non-owner roles, or remove non-owner members; the owner membership
cannot be changed or removed. Item additions, edits, removals, and reorders notify every other
member and link back to the list. List deletion cascades to items, comments, and unused invitations.
Owners can switch a list between private, unlisted, and public. Unlisted and public modes issue a
stable random link; switching back to private revokes it. The anonymous endpoint is read-only and
omits internal list, item, and MongoDB media IDs as well as comments and authentication data.
The anonymous, paginated `GET /api/public/lists` feed includes only public lists, ordered by recent
activity. Its cards expose public owner profiles, item counts, and up to four poster previews without
internal IDs. Unlisted lists remain direct-link-only. A `{ visibility: 1, updatedAt: -1 }` index
supports the feed.

## Container

The Dockerfile includes a dependency-complete development target for the workspace Compose setup
and a minimal non-root runtime target for deployment. The development target includes `procps`
because Nest CLI uses `ps` to terminate the previous application process during watch-mode
recompilation; without it, stale API processes can continue serving outdated routes.

Build the production image:

```bash
docker build -t k-drama-watchlist-server:local .
```

Run it using the local environment file:

```bash
docker run --rm -p 8080:8080 --env-file .env k-drama-watchlist-server:local
```

Cloud Run must provide production environment values through its secret and environment configuration. The application listens on `process.env.PORT` and stores no process-local user state.
