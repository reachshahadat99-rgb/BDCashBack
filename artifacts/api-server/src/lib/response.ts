/**
 * Consistent API response helpers.
 *
 * Use these instead of hand-rolling { error: msg } objects in every route.
 * The envelope shapes match what the generated client already expects, so
 * no OpenAPI contract changes are needed.
 */

import type { Response } from "express";

/** Send a 4xx/5xx error response with a consistent shape. */
export function sendError(
  res: Response,
  status: 400 | 401 | 402 | 403 | 404 | 409 | 500,
  message: string,
): void {
  res.status(status).json({ error: message });
}

/** Convert an unknown thrown value to a plain error message. */
export function toMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  return err instanceof Error ? err.message : fallback;
}
