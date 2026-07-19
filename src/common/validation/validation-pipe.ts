import { HttpStatus, ValidationPipe } from "@nestjs/common";
import { type ValidationError } from "class-validator";

import { ApiException } from "../errors/api-exception";

interface ValidationIssue {
  messages: string[];
  path: string;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
    validationError: {
      target: false,
      value: false,
    },
    whitelist: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: { issues: flattenValidationErrors(errors) },
      }),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = "",
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownIssue =
      error.constraints === undefined
        ? []
        : [{ path, messages: Object.values(error.constraints) }];
    const childIssues = flattenValidationErrors(error.children ?? [], path);

    return [...ownIssue, ...childIssues];
  });
}
