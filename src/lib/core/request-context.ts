import { randomUUID } from "crypto";

export function getCorrelationId(request: Request): string {
  return (
    request.headers.get("x-correlation-id") ??
    randomUUID()
  );
}