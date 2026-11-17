import "server-only";
import { ApiError } from "@/lib/http/errors";

export function databaseError(error: { code?: string }): never {
  switch (error.code) {
    case "PT401": throw new ApiError("UNAUTHENTICATED", "Please sign in with a confirmed account.");
    case "PT404": throw new ApiError("NOT_FOUND", "Resource not found.");
    case "PT400": case "23514": case "23503": throw new ApiError("INVALID_INPUT", "Check the submitted fields and uploaded image.");
    case "PT409": case "23505": throw new ApiError("CONFLICT", "This record conflicts with an existing record or cannot be changed.");
    default: throw new ApiError("UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
  }
}
