"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HealthResponse } from "@/types/health";
import { fetchHealth } from "./api";

export type HealthState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "success"; data: HealthResponse };

// Must exceed the server-side proxy timeout (BACKEND_TIMEOUT_MS, default 8000).
const TIMEOUT_MS = 10000;

export function useHealth() {
  // Initial state is "loading", so the first request does not need to set it again.
  const [state, setState] = useState<HealthState>({ phase: "loading" });
  const controller = useRef<AbortController | null>(null);

  /** Starts a request; resolves to the new state, or null if a newer request superseded it. */
  const request = useCallback(async (): Promise<HealthState | null> => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let result: HealthState;
    try {
      result = { phase: "success", data: await fetchHealth(ctrl.signal) };
    } catch {
      result = { phase: "error" };
    } finally {
      clearTimeout(timer);
    }
    return controller.current === ctrl ? result : null;
  }, []);

  const refresh = useCallback(() => {
    setState({ phase: "loading" });
    void request().then((next) => next && setState(next));
  }, [request]);

  useEffect(() => {
    void request().then((next) => next && setState(next));
    return () => controller.current?.abort();
  }, [request]);

  return { state, refresh };
}
