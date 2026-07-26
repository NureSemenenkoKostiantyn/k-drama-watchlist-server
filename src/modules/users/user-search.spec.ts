import { ObjectId } from "mongodb";

import { type StoredPublicUser } from "./users.repository";
import { rankUserSearchCandidates } from "./user-search";

describe("rankUserSearchCandidates", () => {
  const joinedAt = new Date("2026-07-20T10:00:00.000Z");
  const users = [
    buildUser("dahyun", "Kim Dahyun"),
    buildUser("dahyun_fan", "Fan Account"),
    buildUser("twice.archive", "Dahyun Archive"),
    buildUser("dubuforever", "Dahyun Admirer"),
    buildUser("chaeyoung", "Son Chaeyoung"),
    buildUser("unrelated", "Completely Different"),
  ];

  it("ranks username and name matches by their match quality", () => {
    const results = rankUserSearchCandidates(users, "dahyun", 10);

    expect(
      results.map(({ user, match }) => ({
        username: user.username,
        match,
      })),
    ).toEqual([
      {
        username: "dahyun",
        match: { field: "username", kind: "exact" },
      },
      {
        username: "dahyun_fan",
        match: { field: "username", kind: "prefix" },
      },
      {
        username: "dubuforever",
        match: { field: "name", kind: "word_prefix" },
      },
      {
        username: "twice.archive",
        match: { field: "name", kind: "word_prefix" },
      },
    ]);
  });

  it("normalizes punctuation, spaces, casing, and accents", () => {
    const result = rankUserSearchCandidates(
      [buildUser("seo-yeji", "Séo Ye-ji")],
      "SEO YEJI",
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.match).toEqual({
      field: "username",
      kind: "exact",
    });
  });

  it("returns close username and name matches for minor typos", () => {
    const usernameResult = rankUserSearchCandidates(
      [buildUser("dahyun", "Kim Dahyun")],
      "dahyyn",
      10,
    );
    const nameResult = rankUserSearchCandidates(
      [buildUser("dubu", "Dahyun")],
      "dahyyn",
      10,
    );

    expect(usernameResult[0]?.match).toEqual({
      field: "username",
      kind: "similar",
    });
    expect(nameResult[0]?.match).toEqual({
      field: "name",
      kind: "similar",
    });
  });

  it("does not return unrelated users and respects the result limit", () => {
    const results = rankUserSearchCandidates(users, "dah", 2);

    expect(results).toHaveLength(2);
    expect(
      results.map(({ user }) => user.username),
    ).not.toContain("unrelated");
  });

  function buildUser(
    username: string,
    name: string,
  ): StoredPublicUser {
    return {
      _id: new ObjectId(),
      username,
      name,
      createdAt: joinedAt,
    };
  }
});
