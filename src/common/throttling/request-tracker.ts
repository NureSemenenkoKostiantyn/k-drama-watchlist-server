export function getRequestTracker(request: unknown): string {
  const requestRecord = readRecord(request);
  const user = readRecord(requestRecord?.["user"]);
  const userId = readNonEmptyString(user?.["id"]);

  if (userId !== undefined) {
    return `user:${userId}`;
  }

  const socket = readRecord(requestRecord?.["socket"]);
  const remoteAddress = readNonEmptyString(socket?.["remoteAddress"]);

  return `connection:${remoteAddress ?? "unknown"}`;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0
    ? value
    : undefined;
}
