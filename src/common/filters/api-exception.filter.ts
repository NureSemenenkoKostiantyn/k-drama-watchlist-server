import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

import {
  ApiException,
  type ApiErrorResponse,
} from "../errors/api-exception";

interface NormalizedException {
  statusCode: number;
  body: ApiErrorResponse;
  isUnexpected: boolean;
}

interface RequestContext {
  method?: string;
  url?: string;
}

const statusCodes: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_ERROR",
  [HttpStatus.UNAUTHORIZED]: "AUTH_REQUIRED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
};

const statusMessages: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "Request validation failed.",
  [HttpStatus.UNAUTHORIZED]: "Authentication is required.",
  [HttpStatus.FORBIDDEN]: "You do not have permission to perform this action.",
  [HttpStatus.NOT_FOUND]: "Resource not found.",
  [HttpStatus.TOO_MANY_REQUESTS]: "Too many requests.",
};

const internalServerErrorStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;

export function normalizeException(exception: unknown): NormalizedException {
  if (exception instanceof ApiException) {
    const error: ApiErrorResponse["error"] = {
      code: exception.code,
      message: exception.message,
    };

    if (exception.details !== undefined) {
      error.details = exception.details;
    }

    return {
      statusCode: exception.getStatus(),
      body: { error },
      isUnexpected: false,
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const code = statusCodes[statusCode] ?? "INTERNAL_SERVER_ERROR";
    const message =
      statusMessages[statusCode] ??
      (statusCode < internalServerErrorStatus
        ? exception.message
        : "An unexpected error occurred.");

    return {
      statusCode,
      body: { error: { code, message } },
      isUnexpected: statusCode >= internalServerErrorStatus,
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    isUnexpected: true,
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<RequestContext>();
    const normalized = normalizeException(exception);

    if (normalized.isUnexpected) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method ?? "UNKNOWN"} ${request.url ?? "UNKNOWN"} failed`,
        stack,
      );
    }

    this.httpAdapterHost.httpAdapter.reply(
      httpContext.getResponse<unknown>(),
      normalized.body,
      normalized.statusCode,
    );
  }
}
