import { type StoredPublicUser } from "./users.repository";

type UserSearchMatchField = "username" | "name";

type UserSearchMatchKind =
  | "exact"
  | "prefix"
  | "word_prefix"
  | "substring"
  | "similar";

export interface RankedUserSearchResult {
  user: StoredPublicUser;
  match: {
    field: UserSearchMatchField;
    kind: UserSearchMatchKind;
  };
}

interface ScoredMatch extends RankedUserSearchResult {
  score: number;
}

interface NormalizedValue {
  compact: string;
  phrase: string;
  tokens: string[];
}

export function rankUserSearchCandidates(
  users: StoredPublicUser[],
  query: string,
  limit: number,
): RankedUserSearchResult[] {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery.compact) {
    return [];
  }

  return users
    .map((user) => scoreUser(user, normalizedQuery))
    .filter((result): result is ScoredMatch => result !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.user.username.localeCompare(right.user.username),
    )
    .slice(0, limit)
    .map(({ user, match }) => ({ user, match }));
}

function scoreUser(
  user: StoredPublicUser,
  query: NormalizedValue,
): ScoredMatch | null {
  const username = normalizeSearchValue(user.username);
  const name = normalizeSearchValue(user.name);
  const matches = [
    scoreUsername(username, query),
    scoreName(name, query),
    scoreSimilar(username, query, "username", 500),
    scoreSimilar(name, query, "name", 450),
    ...name.tokens.map((token) =>
      scoreSimilar(
        normalizeSearchValue(token),
        query,
        "name",
        440,
      ),
    ),
  ].filter((match): match is Omit<ScoredMatch, "user"> => match !== null);
  const bestMatch = matches.sort(
    (left, right) => right.score - left.score,
  )[0];

  return bestMatch ? { user, ...bestMatch } : null;
}

function scoreUsername(
  username: NormalizedValue,
  query: NormalizedValue,
): Omit<ScoredMatch, "user"> | null {
  if (username.compact === query.compact) {
    return buildMatch("username", "exact", 1_000);
  }

  if (username.compact.startsWith(query.compact)) {
    return buildMatch("username", "prefix", 900);
  }

  if (username.compact.includes(query.compact)) {
    return buildMatch("username", "substring", 700);
  }

  return null;
}

function scoreName(
  name: NormalizedValue,
  query: NormalizedValue,
): Omit<ScoredMatch, "user"> | null {
  if (
    name.phrase === query.phrase ||
    name.compact === query.compact
  ) {
    return buildMatch("name", "exact", 850);
  }

  if (
    query.tokens.every((queryToken) =>
      name.tokens.some((nameToken) =>
        nameToken.startsWith(queryToken),
      ),
    )
  ) {
    return buildMatch("name", "word_prefix", 800);
  }

  if (
    name.phrase.includes(query.phrase) ||
    name.compact.includes(query.compact)
  ) {
    return buildMatch("name", "substring", 650);
  }

  return null;
}

function scoreSimilar(
  value: NormalizedValue,
  query: NormalizedValue,
  field: UserSearchMatchField,
  baseScore: number,
): Omit<ScoredMatch, "user"> | null {
  const maximumDistance = allowedDistance(query.compact.length);

  if (
    maximumDistance === 0 ||
    Math.abs(value.compact.length - query.compact.length) >
      maximumDistance
  ) {
    return null;
  }

  const distance = damerauLevenshteinDistance(
    value.compact,
    query.compact,
    maximumDistance,
  );
  const longestLength = Math.max(
    value.compact.length,
    query.compact.length,
  );
  const similarity = 1 - distance / longestLength;

  if (distance > maximumDistance || similarity < 0.65) {
    return null;
  }

  return buildMatch(
    field,
    "similar",
    baseScore + Math.round(similarity * 100) - distance,
  );
}

function buildMatch(
  field: UserSearchMatchField,
  kind: UserSearchMatchKind,
  score: number,
): Omit<ScoredMatch, "user"> {
  return { match: { field, kind }, score };
}

function normalizeSearchValue(value: string): NormalizedValue {
  const phrase = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  return {
    phrase,
    compact: phrase.replace(/\s/g, ""),
    tokens: phrase ? phrase.split(" ") : [],
  };
}

function allowedDistance(length: number): number {
  if (length <= 2) {
    return 0;
  }

  if (length <= 4) {
    return 1;
  }

  if (length <= 8) {
    return 2;
  }

  return 3;
}

function damerauLevenshteinDistance(
  left: string,
  right: string,
  maximumDistance: number,
): number {
  if (Math.abs(left.length - right.length) > maximumDistance) {
    return maximumDistance + 1;
  }

  const matrix = Array.from(
    { length: left.length + 1 },
    () => Array<number>(right.length + 1).fill(0),
  );

  for (let leftIndex = 0; leftIndex <= left.length; leftIndex += 1) {
    matrix[leftIndex]![0] = leftIndex;
  }

  for (
    let rightIndex = 0;
    rightIndex <= right.length;
    rightIndex += 1
  ) {
    matrix[0]![rightIndex] = rightIndex;
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let rowMinimum = Number.POSITIVE_INFINITY;

    for (
      let rightIndex = 1;
      rightIndex <= right.length;
      rightIndex += 1
    ) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      let distance = Math.min(
        matrix[leftIndex - 1]![rightIndex]! + 1,
        matrix[leftIndex]![rightIndex - 1]! + 1,
        matrix[leftIndex - 1]![rightIndex - 1]! +
          substitutionCost,
      );

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(
          distance,
          matrix[leftIndex - 2]![rightIndex - 2]! + 1,
        );
      }

      matrix[leftIndex]![rightIndex] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > maximumDistance) {
      return maximumDistance + 1;
    }
  }

  return matrix[left.length]![right.length]!;
}
