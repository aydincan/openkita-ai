import type { ComponentHealth, HealthResponse } from "@/types/health";

const STATES = ["up", "down", "disabled"];

function isComponent(value: unknown): value is ComponentHealth {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { status?: unknown }).status === "string" &&
    STATES.includes((value as { status: string }).status)
  );
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<HealthResponse>;
  const c = v.components;
  return (
    (v.status === "ok" || v.status === "error") &&
    typeof v.version === "string" &&
    typeof c === "object" &&
    c !== null &&
    isComponent(c.api) &&
    isComponent(c.database) &&
    isComponent(c.ai)
  );
}

export class HealthFetchError extends Error {}

/**
 * Fetch the status through the frontend's own proxy route. A 503 from the backend still carries a
 * valid body (database down) and is returned normally; anything else is an error.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch("/api/health", { cache: "no-store", signal });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new HealthFetchError("network error");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new HealthFetchError(`invalid response (HTTP ${response.status})`);
  }
  if (!isHealthResponse(body)) {
    throw new HealthFetchError(`unexpected response (HTTP ${response.status})`);
  }
  return body;
}
