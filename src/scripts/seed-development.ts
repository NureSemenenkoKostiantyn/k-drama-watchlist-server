import { hashPassword as hashBetterAuthPassword } from "better-auth/crypto";
import {
  type Collection,
  type Db,
  type ObjectId,
  type WithId,
} from "mongodb";

const developmentDatabaseName = "drama_watch";
const allowedDevelopmentHosts = new Set([
  "127.0.0.1",
  "::1",
  "localhost",
  "mongodb",
]);
const hashDevelopmentPassword = hashBetterAuthPassword as (
  password: string,
) => Promise<string>;

export const developmentDemoCredentials = {
  email: "demo@drama-watch.local",
  password: "DramaWatch1!",
} as const;

interface SeedEnvironment {
  NODE_ENV?: string;
  MONGODB_URI?: string;
  MONGODB_DB_NAME?: string;
}

interface SeedUser {
  _id: ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayUsername: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SeedMedia {
  _id: ObjectId;
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  originalTitle: string;
  overview: string;
  firstAirDate?: string;
  releaseDate?: string;
  originCountry: string[];
  originalLanguage: string;
  genreIds: number[];
  totalEpisodes?: number;
  totalSeasons?: number;
  seasons?: Array<{
    seasonNumber: number;
    name: string;
    episodeCount: number;
  }>;
  runtimeMinutes?: number;
  tmdbVoteAverage: number;
  tmdbVoteCount: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SeedCategory {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  slug: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SeedPriorityLane {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  position: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function assertDevelopmentSeedEnvironment(
  environment: SeedEnvironment,
): {
  mongodbUri: string;
  databaseName: string;
} {
  if (environment.NODE_ENV !== "development") {
    throw new Error(
      "Development seed refused: NODE_ENV must be development.",
    );
  }

  const mongodbUri = environment.MONGODB_URI;
  const databaseName = environment.MONGODB_DB_NAME;

  if (!mongodbUri || !databaseName) {
    throw new Error(
      "Development seed refused: MONGODB_URI and MONGODB_DB_NAME are required.",
    );
  }

  let parsedUri: URL;

  try {
    parsedUri = new URL(mongodbUri);
  } catch {
    throw new Error(
      "Development seed refused: MONGODB_URI is invalid.",
    );
  }

  if (
    parsedUri.protocol !== "mongodb:" ||
    !allowedDevelopmentHosts.has(parsedUri.hostname)
  ) {
    throw new Error(
      "Development seed refused: MongoDB must use a local or Compose hostname.",
    );
  }

  if (databaseName !== developmentDatabaseName) {
    throw new Error(
      `Development seed refused: database must be ${developmentDatabaseName}.`,
    );
  }

  return { mongodbUri, databaseName };
}

export async function seedDevelopmentData(
  database: Db,
): Promise<void> {
  const now = new Date();
  const users = await seedUsers(database, now);
  const passwordHash = await hashDevelopmentPassword(
    developmentDemoCredentials.password,
  );
  await seedCredentialAccount(
    database,
    users.demo._id,
    passwordHash,
    now,
  );
  await seedFriendships(database, users, now);
  await seedUserSettings(database, users, now);

  const media = await seedMedia(database, now);
  await seedSuggestions(database, users, media, now);
  await seedNotifications(database, users, media, now);
  const categories = await seedCategories(
    database,
    users.demo._id,
    now,
  );
  const lanes = await seedPriorityLanes(
    database,
    users.demo._id,
    now,
  );
  await seedPersonalLibrary(
    database,
    users.demo._id,
    media,
    categories,
    lanes,
    now,
  );
  await seedFriendMediaContext(
    database,
    users.acceptedFriend._id,
    media,
    now,
  );
}

async function seedUsers(
  database: Db,
  now: Date,
): Promise<{
  demo: SeedUser;
  acceptedFriend: SeedUser;
  incomingFriend: SeedUser;
  outgoingFriend: SeedUser;
}> {
  const users = database.collection<SeedUser>("user");
  const demo = await upsertUser(users, {
    name: "Demo Viewer",
    email: developmentDemoCredentials.email,
    username: "demo_viewer",
    displayUsername: "Demo_Viewer",
  }, now);
  const acceptedFriend = await upsertUser(users, {
    name: "Dahyun Fan",
    email: "dahyun.fan@drama-watch.local",
    username: "dahyun_fan",
    displayUsername: "Dahyun_Fan",
  }, now);
  const incomingFriend = await upsertUser(users, {
    name: "K-Drama Club",
    email: "kdrama.club@drama-watch.local",
    username: "kdrama_club",
    displayUsername: "KDrama_Club",
  }, now);
  const outgoingFriend = await upsertUser(users, {
    name: "Seoul Screen",
    email: "seoul.screen@drama-watch.local",
    username: "seoul_screen",
    displayUsername: "Seoul_Screen",
  }, now);

  return {
    demo,
    acceptedFriend,
    incomingFriend,
    outgoingFriend,
  };
}

async function upsertUser(
  collection: Collection<SeedUser>,
  input: Pick<
    SeedUser,
    "name" | "email" | "username" | "displayUsername"
  >,
  now: Date,
): Promise<WithId<SeedUser>> {
  const user = await collection.findOneAndUpdate(
    { email: input.email },
    {
      $set: {
        ...input,
        emailVerified: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  if (!user) {
    throw new Error(`Could not seed user ${input.email}.`);
  }

  return user;
}

async function seedCredentialAccount(
  database: Db,
  userId: ObjectId,
  password: string,
  now: Date,
): Promise<void> {
  await database.collection("account").updateOne(
    {
      providerId: "credential",
      accountId: userId.toHexString(),
    },
    {
      $set: {
        userId,
        password,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

async function seedFriendships(
  database: Db,
  users: {
    demo: SeedUser;
    acceptedFriend: SeedUser;
    incomingFriend: SeedUser;
    outgoingFriend: SeedUser;
  },
  now: Date,
): Promise<void> {
  const friendships = database.collection("friendships");
  const acceptedAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);

  await Promise.all([
    upsertFriendship(
      friendships,
      users.demo._id,
      users.acceptedFriend._id,
      "accepted",
      now,
      acceptedAt,
    ),
    upsertFriendship(
      friendships,
      users.incomingFriend._id,
      users.demo._id,
      "pending",
      now,
    ),
    upsertFriendship(
      friendships,
      users.demo._id,
      users.outgoingFriend._id,
      "pending",
      now,
    ),
  ]);
}

async function seedUserSettings(
  database: Db,
  users: {
    demo: SeedUser;
    acceptedFriend: SeedUser;
  },
  now: Date,
): Promise<void> {
  const settings = database.collection("userSettings");

  await Promise.all(
    [users.demo._id, users.acceptedFriend._id].map((userId) =>
      settings.updateOne(
        { userId },
        {
          $set: {
            libraryVisibility: "friends",
            updatedAt: now,
          },
          $setOnInsert: {
            userId,
            createdAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function upsertFriendship(
  collection: Collection,
  requesterId: ObjectId,
  recipientId: ObjectId,
  status: "pending" | "accepted",
  now: Date,
  acceptedAt?: Date,
): Promise<void> {
  const pairKey = createPairKey(requesterId, recipientId);
  await collection.updateOne(
    { pairKey },
    {
      $set: {
        requesterId,
        recipientId,
        pairKey,
        status,
        ...(acceptedAt === undefined ? {} : { acceptedAt }),
      },
      ...(acceptedAt === undefined
        ? { $unset: { acceptedAt: 1 } }
        : {}),
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

async function seedMedia(
  database: Db,
  now: Date,
): Promise<Record<string, SeedMedia>> {
  const media = database.collection<SeedMedia>("media");
  const inputs: Array<Omit<SeedMedia, "_id" | "createdAt" | "updatedAt">> = [
    {
      tmdbId: 67915,
      mediaType: "tv",
      title: "Goblin",
      originalTitle: "Guardian: The Lonely and Great God",
      overview: "A fantasy romance used as local development data.",
      firstAirDate: "2016-12-02",
      originCountry: ["KR"],
      originalLanguage: "ko",
      genreIds: [18, 35, 10765],
      totalEpisodes: 16,
      totalSeasons: 1,
      seasons: [
        {
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 16,
        },
      ],
      tmdbVoteAverage: 8.6,
      tmdbVoteCount: 3_000,
      lastSyncedAt: now,
    },
    {
      tmdbId: 94796,
      mediaType: "tv",
      title: "Crash Landing on You",
      originalTitle: "Crash Landing on You",
      overview: "A romantic drama used as local development data.",
      firstAirDate: "2019-12-14",
      originCountry: ["KR"],
      originalLanguage: "ko",
      genreIds: [18, 35],
      totalEpisodes: 16,
      totalSeasons: 1,
      seasons: [
        {
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 16,
        },
      ],
      tmdbVoteAverage: 8.6,
      tmdbVoteCount: 900,
      lastSyncedAt: now,
    },
    {
      tmdbId: 197067,
      mediaType: "tv",
      title: "Extraordinary Attorney Woo",
      originalTitle: "Extraordinary Attorney Woo",
      overview: "A legal drama used as local development data.",
      firstAirDate: "2022-06-29",
      originCountry: ["KR"],
      originalLanguage: "ko",
      genreIds: [18],
      totalEpisodes: 16,
      totalSeasons: 1,
      seasons: [
        {
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 16,
        },
      ],
      tmdbVoteAverage: 8.5,
      tmdbVoteCount: 800,
      lastSyncedAt: now,
    },
    {
      tmdbId: 496243,
      mediaType: "movie",
      title: "Parasite",
      originalTitle: "Parasite",
      overview: "A thriller used as local development data.",
      releaseDate: "2019-05-30",
      originCountry: ["KR"],
      originalLanguage: "ko",
      genreIds: [18, 35, 53],
      runtimeMinutes: 133,
      tmdbVoteAverage: 8.5,
      tmdbVoteCount: 19_000,
      lastSyncedAt: now,
    },
  ];
  const seeded: Record<string, SeedMedia> = {};

  for (const input of inputs) {
    const document = await media.findOneAndUpdate(
      {
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
      },
      {
        $set: {
          ...input,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    if (!document) {
      throw new Error(`Could not seed media ${input.title}.`);
    }

    seeded[`${input.mediaType}:${input.tmdbId}`] = document;
  }

  return seeded;
}

async function seedSuggestions(
  database: Db,
  users: {
    demo: SeedUser;
    acceptedFriend: SeedUser;
  },
  media: Record<string, SeedMedia>,
  now: Date,
): Promise<void> {
  const goblin = requireSeeded(media, "tv:67915");
  const crashLanding = requireSeeded(media, "tv:94796");
  const suggestions = database.collection("suggestions");

  await Promise.all([
    suggestions.updateOne(
      {
        fromUserId: users.acceptedFriend._id,
        toUserId: users.demo._id,
        mediaId: goblin._id,
      },
      {
        $setOnInsert: {
          message: "The chemistry and fantasy story make this a must-watch.",
          status: "pending",
          createdAt: now,
        },
      },
      { upsert: true },
    ),
    suggestions.updateOne(
      {
        fromUserId: users.demo._id,
        toUserId: users.acceptedFriend._id,
        mediaId: crashLanding._id,
      },
      {
        $setOnInsert: {
          message: "Try this when you want romance with a big adventure.",
          status: "pending",
          createdAt: now,
        },
      },
      { upsert: true },
    ),
  ]);
}

async function seedNotifications(
  database: Db,
  users: {
    demo: SeedUser;
    acceptedFriend: SeedUser;
    incomingFriend: SeedUser;
  },
  media: Record<string, SeedMedia>,
  now: Date,
): Promise<void> {
  const goblin = requireSeeded(media, "tv:67915");
  const [acceptedFriendship, incomingFriendship, suggestion] =
    await Promise.all([
      database.collection("friendships").findOne({
        requesterId: users.demo._id,
        recipientId: users.acceptedFriend._id,
      }),
      database.collection("friendships").findOne({
        requesterId: users.incomingFriend._id,
        recipientId: users.demo._id,
      }),
      database.collection("suggestions").findOne({
        fromUserId: users.acceptedFriend._id,
        toUserId: users.demo._id,
        mediaId: goblin._id,
      }),
    ]);

  if (!acceptedFriendship || !incomingFriendship || !suggestion) {
    throw new Error(
      "Development seed could not resolve notification entities.",
    );
  }

  const notifications = database.collection("notifications");
  const inputs = [
    {
      type: "friend_request_accepted",
      actorUserId: users.acceptedFriend._id,
      entityId: acceptedFriendship._id,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1_000),
      isRead: true,
    },
    {
      type: "friend_request",
      actorUserId: users.incomingFriend._id,
      entityId: incomingFriendship._id,
      createdAt: new Date(now.getTime() - 60 * 60 * 1_000),
      isRead: false,
    },
    {
      type: "suggestion_received",
      actorUserId: users.acceptedFriend._id,
      entityId: suggestion._id,
      createdAt: new Date(now.getTime() - 30 * 60 * 1_000),
      isRead: false,
    },
  ];

  await Promise.all(
    inputs.map((input) =>
      notifications.updateOne(
        {
          userId: users.demo._id,
          type: input.type,
          entityId: input.entityId,
        },
        {
          $set: {
            actorUserId: input.actorUserId,
            createdAt: input.createdAt,
            isRead: input.isRead,
            ...(input.isRead ? { readAt: input.createdAt } : {}),
          },
          ...(input.isRead ? {} : { $unset: { readAt: 1 } }),
          $setOnInsert: {
            userId: users.demo._id,
            type: input.type,
            entityId: input.entityId,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function seedCategories(
  database: Db,
  userId: ObjectId,
  now: Date,
): Promise<Record<string, SeedCategory>> {
  const categories = database.collection<SeedCategory>("categories");
  const inputs = [
    { name: "Comfort drama", slug: "comfort-drama", icon: "heart" },
    { name: "Korean thriller", slug: "korean-thriller", icon: "moon" },
  ];
  const seeded: Record<string, SeedCategory> = {};

  for (const input of inputs) {
    const document = await categories.findOneAndUpdate(
      { userId, slug: input.slug },
      {
        $set: {
          ...input,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    if (!document) {
      throw new Error(`Could not seed category ${input.name}.`);
    }

    seeded[input.slug] = document;
  }

  return seeded;
}

async function seedPriorityLanes(
  database: Db,
  userId: ObjectId,
  now: Date,
): Promise<Record<string, SeedPriorityLane>> {
  const lanes = database.collection<SeedPriorityLane>("priorityLanes");
  const names = [
    "Must watch",
    "I really want to watch",
    "Maybe",
    "If there is nothing else",
  ];
  const seeded: Record<string, SeedPriorityLane> = {};

  for (const [position, name] of names.entries()) {
    const document = await lanes.findOneAndUpdate(
      { userId, name },
      {
        $set: {
          position,
          isDefault: true,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    if (!document) {
      throw new Error(`Could not seed priority lane ${name}.`);
    }

    seeded[name] = document;
  }

  return seeded;
}

async function seedPersonalLibrary(
  database: Db,
  userId: ObjectId,
  media: Record<string, SeedMedia>,
  categories: Record<string, SeedCategory>,
  lanes: Record<string, SeedPriorityLane>,
  now: Date,
): Promise<void> {
  const goblin = requireSeeded(media, "tv:67915");
  const crashLanding = requireSeeded(media, "tv:94796");
  const attorneyWoo = requireSeeded(media, "tv:197067");
  const parasite = requireSeeded(media, "movie:496243");
  const comfort = requireSeeded(categories, "comfort-drama");
  const thriller = requireSeeded(categories, "korean-thriller");
  const mustWatch = requireSeeded(lanes, "Must watch");
  const reallyWant = requireSeeded(lanes, "I really want to watch");
  const userMedia = database.collection("userMedia");

  await Promise.all([
    upsertUserMedia(userMedia, userId, goblin._id, {
      status: "to_watch",
      categoryIds: [comfort._id],
      priorityLaneId: mustWatch._id,
      priorityPosition: 0,
    }, now),
    upsertUserMedia(userMedia, userId, attorneyWoo._id, {
      status: "to_watch",
      categoryIds: [comfort._id],
      priorityLaneId: reallyWant._id,
      priorityPosition: 0,
    }, now),
    upsertUserMedia(userMedia, userId, crashLanding._id, {
      status: "watching",
      categoryIds: [comfort._id],
      progress: {
        currentSeason: 1,
        currentEpisode: 7,
        completedEpisodes: 6,
        totalEpisodesSnapshot: 16,
        completedSeasonNumbers: [],
        includeSpecials: false,
        updatedAt: now,
      },
      startedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1_000),
      lastProgressAt: now,
    }, now),
    upsertUserMedia(userMedia, userId, parasite._id, {
      status: "watched",
      categoryIds: [thriller._id],
      rating: 9,
      description: "Seeded private note for local card and rating previews.",
      completedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000),
    }, now),
  ]);
}

async function seedFriendMediaContext(
  database: Db,
  friendId: ObjectId,
  media: Record<string, SeedMedia>,
  now: Date,
): Promise<void> {
  const goblin = requireSeeded(media, "tv:67915");
  const crashLanding = requireSeeded(media, "tv:94796");
  const userMedia = database.collection("userMedia");

  await Promise.all([
    upsertUserMedia(
      userMedia,
      friendId,
      goblin._id,
      {
        status: "watched",
        rating: 8.5,
        description: "Private seed note hidden from friend context.",
        categoryIds: [],
      },
      now,
    ),
    upsertUserMedia(
      userMedia,
      friendId,
      crashLanding._id,
      {
        status: "to_watch",
        categoryIds: [],
      },
      now,
    ),
  ]);
}

async function upsertUserMedia(
  collection: Collection,
  userId: ObjectId,
  mediaId: ObjectId,
  input: Record<string, unknown>,
  now: Date,
): Promise<void> {
  await collection.updateOne(
    { userId, mediaId },
    {
      $set: {
        ...input,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

function createPairKey(
  firstUserId: ObjectId,
  secondUserId: ObjectId,
): string {
  return [firstUserId.toHexString(), secondUserId.toHexString()]
    .sort()
    .join(":");
}

function requireSeeded<T>(
  records: Record<string, T>,
  key: string,
): T {
  const record = records[key];

  if (!record) {
    throw new Error(`Required seed record ${key} is unavailable.`);
  }

  return record;
}
