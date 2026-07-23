import { getRequestTracker } from "./request-tracker";

describe("getRequestTracker", () => {
  it("tracks authenticated requests by their Better Auth user ID", () => {
    expect(
      getRequestTracker({
        user: { id: "user-123" },
        socket: { remoteAddress: "10.0.0.1" },
      }),
    ).toBe("user:user-123");
  });

  it("falls back to the direct connection without trusting forwarded headers", () => {
    expect(
      getRequestTracker({
        headers: {
          "x-forwarded-for": "198.51.100.20",
        },
        socket: { remoteAddress: "10.0.0.2" },
      }),
    ).toBe("connection:10.0.0.2");
  });
});
