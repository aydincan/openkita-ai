/** Mirrors backend/app/schemas/health.py */
export type ComponentState = "up" | "down" | "disabled";

export type ComponentHealth = {
  status: ComponentState;
  detail: string | null;
  latency_ms: number | null;
};

export type HealthResponse = {
  status: "ok" | "error";
  version: string;
  environment: string;
  components: {
    api: ComponentHealth;
    database: ComponentHealth;
    ai: ComponentHealth;
  };
};
