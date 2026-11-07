import "server-only";

/** Backend base URL used by server-side code only (never exposed to the browser). */
export const BACKEND_INTERNAL_URL = (
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

/**
 * Max wait for the backend in the /api/health proxy. Must outlast the backend health check
 * (HEALTH_CHECK_TIMEOUT_SECONDS, max 5 s, plus 1 s) and stay under the browser limit of 10 s.
 * Only 7000–9000 is accepted; anything else falls back to 8000.
 */
export const BACKEND_TIMEOUT_MS = (() => {
  const value = Number(process.env.BACKEND_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 7000 && value <= 9000 ? value : 8000;
})();

/** Local letter generation can take much longer than a health check. */
export const BACKEND_GENERATE_TIMEOUT_MS = (() => {
  const value = Number(process.env.BACKEND_GENERATE_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 10_000 && value <= 300_000 ? value : 130_000;
})();
