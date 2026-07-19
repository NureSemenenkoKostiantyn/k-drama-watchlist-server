import { HttpStatus, NotFoundException } from "@nestjs/common";

import { ApiException } from "../errors/api-exception";
import { normalizeException } from "./api-exception.filter";

describe("normalizeException", () => {
  it("preserves an explicit API exception", () => {
    const normalized = normalizeException(
      new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
        details: { field: "query" },
      }),
    );

    expect(normalized).toEqual({
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
          details: { field: "query" },
        },
      },
      isUnexpected: false,
    });
  });

  it("normalizes NestJS not-found exceptions", () => {
    expect(normalizeException(new NotFoundException())).toEqual({
      statusCode: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Resource not found.",
        },
      },
      isUnexpected: false,
    });
  });

  it("hides unexpected exception details", () => {
    expect(normalizeException(new Error("sensitive details"))).toEqual({
      statusCode: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      isUnexpected: true,
    });
  });
});
