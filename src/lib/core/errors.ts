import { DomainError } from "@/lib/core/domain-error";

export enum ErrorCode {
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  DB_ERROR = "DB_ERROR",
}

const DEFAULT_STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.DB_ERROR]: 500,
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly meta?: Record<string, unknown>;

  constructor({
    message,
    code = ErrorCode.INTERNAL_ERROR,
    statusCode,
    meta,
    isOperational = true,
  }: {
    message: string;
    code?: ErrorCode;
    statusCode?: number;
    meta?: Record<string, unknown>;
    isOperational?: boolean;
  }) {
    super(message);

    this.code = code;
    this.statusCode = statusCode ?? DEFAULT_STATUS_BY_CODE[code];
    this.meta = meta;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  // ---------- FACTORY HELPERS ----------

  static validation(message = "Validation error", meta?: Record<string, unknown>) {
    return new AppError({ message, code: ErrorCode.VALIDATION_ERROR, meta });
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError({ message, code: ErrorCode.UNAUTHORIZED });
  }

  static forbidden(message = "Forbidden") {
    return new AppError({ message, code: ErrorCode.FORBIDDEN });
  }

  static notFound(message = "Not found") {
    return new AppError({ message, code: ErrorCode.NOT_FOUND });
  }

  static conflict(message = "Conflict", meta?: Record<string, unknown>) {
    return new AppError({ message, code: ErrorCode.CONFLICT, meta });
  }

  static db(message = "Database error", meta?: Record<string, unknown>) {
    return new AppError({ message, code: ErrorCode.DB_ERROR, meta });
  }

  static rateLimited(message = "Too many requests") {
    return new AppError({ message, code: ErrorCode.RATE_LIMITED });
  }

  static internal(message = "Internal server error") {
    return new AppError({
      message,
      code: ErrorCode.INTERNAL_ERROR,
      isOperational: false,
    });
  }
}

/**
 * Mapping DomainError → HTTP ErrorCode
 * Tu peux enrichir ce mapping selon ton business.
 */
function mapDomainCodeToErrorCode(domainCode: string): ErrorCode {
  switch (domainCode) {
    case "USERNAME_TAKEN":
      return ErrorCode.CONFLICT;

    case "PROFILE_NOT_FOUND":
      return ErrorCode.NOT_FOUND;

    case "INVALID_PROFILE_STATE":
      return ErrorCode.VALIDATION_ERROR;

    case "DB_ERROR":
      return ErrorCode.DB_ERROR;

    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  // 🔥 Mapping Domain → HTTP
  if (error instanceof DomainError) {
    const mappedCode = mapDomainCodeToErrorCode(error.code);

    return new AppError({
      message: error.message,
      code: mappedCode,
      meta: error.meta,
      isOperational: true,
    });
  }

  // Erreur JS inattendue
  if (error instanceof Error) {
    return AppError.internal(error.message);
  }

  return AppError.internal("Unexpected error");
}