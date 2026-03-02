export class DomainError extends Error {
  public readonly code: string;
  public readonly meta?: Record<string, unknown>;

  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.meta = meta;

    Error.captureStackTrace(this, this.constructor);
  }
}