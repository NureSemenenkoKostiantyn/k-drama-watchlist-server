import { HttpException } from "@nestjs/common";

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface ApiExceptionOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiException extends HttpException {
  readonly code: string;
  readonly details?: unknown;

  constructor(options: ApiExceptionOptions) {
    super(options.message, options.statusCode);
    this.code = options.code;
    this.details = options.details;
  }
}
