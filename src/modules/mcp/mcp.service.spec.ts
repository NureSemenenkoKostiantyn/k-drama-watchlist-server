import { describe, expect, it } from "@jest/globals";

import { resolveMcpPermissions } from "./mcp.service";

describe("resolveMcpPermissions", () => {
  it("grants only the explicitly approved scopes", () => {
    expect(
      resolveMcpPermissions(["mcp:library:read", "mcp:social:write"]),
    ).toEqual({
      libraryRead: true,
      socialRead: false,
      libraryWrite: false,
      socialWrite: true,
    });
  });

  it("does not grant MCP capabilities for identity-only scopes", () => {
    expect(resolveMcpPermissions(["openid", "profile"])).toEqual({
      libraryRead: false,
      socialRead: false,
      libraryWrite: false,
      socialWrite: false,
    });
  });
});
