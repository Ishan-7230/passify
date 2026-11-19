import "server-only";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: { field: string; message: string }[] } };

export function success<T>(data: T, status = 200) {
  return Response.json({ success: true, data } satisfies ApiResponse<T>, { status });
}

/** Run inside each route, including its parsing/guards. Never log raw errors or URLs. */
export async function withApiErrors(run: () => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  let response: Response;
  try {
    response = await run();
  } catch (cause) {
    let error: ApiError;
    if (cause instanceof ApiError) error = cause;
    else if (cause instanceof ZodError) {
      error = new ApiError("INVALID_INPUT", "Check the submitted fields.", cause.issues.map((issue) => ({
        field: issue.path.join("."), message: "Invalid value.",
      })));
    } else {
      error = new ApiError("INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
    if (error.status >= 500) console.error(JSON.stringify({ event: "api_error", requestId, code: error.code }));
    response = Response.json({
      success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    } satisfies ApiResponse<never>, { status: error.status });
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
