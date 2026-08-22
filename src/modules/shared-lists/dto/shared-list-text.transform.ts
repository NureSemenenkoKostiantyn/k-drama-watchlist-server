import { type TransformFnParams } from "class-transformer";

export function trimString(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === "string" ? value.trim() : value;
}
