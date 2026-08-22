export function trimCommentText(input: unknown): unknown {
  return typeof input === "string" ? input.trim() : input;
}
