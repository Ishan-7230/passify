"use client";
import type { ApiResponse } from "./response";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  let body: ApiResponse<T>;
  try { body = await response.json(); } catch { throw new Error("The server could not complete your request. Please retry."); }
  if (!body.success) throw new Error(body.error.message);
  if (!response.ok) throw new Error("The request could not be completed.");
  return body.data;
}
