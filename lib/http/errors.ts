export type ErrorCode =
  | "INVALID_INPUT" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"
  | "CONFLICT" | "PAYLOAD_TOO_LARGE" | "RATE_LIMITED" | "INTERNAL_ERROR" | "UNAVAILABLE";

const statuses: Record<ErrorCode, number> = {
  INVALID_INPUT: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  CONFLICT: 409, PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429, INTERNAL_ERROR: 500, UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message: string, readonly details?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = statuses[code];
  }
}
