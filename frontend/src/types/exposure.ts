export const EXPOSURE_TOPICS = ["heat", "uv", "pollen", "air"] as const;
export const EXPOSURE_DAYS = ["today", "tomorrow", "day_after"] as const;

export type ExposureTopicName = (typeof EXPOSURE_TOPICS)[number];
export type ExposureDay = (typeof EXPOSURE_DAYS)[number];

export type ExposureFact = {
  day: ExposureDay;
  code: string;
  subject: string | null;
};

export type ExposureTopic = {
  topic: ExposureTopicName;
  source_id: "dwd_heat" | "dwd_uv" | "dwd_pollen" | "uba_air";
  origin: "live" | "synthetic";
  licence: string;
  dataset_url: string;
  retrieved_at: string | null;
  source_timestamp: string | null;
  stale: boolean;
  place_label: string;
  reason: "none" | "region_missing" | "source_unreachable" | "unexpected_document" | "no_published_place";
  sample_label_de: string | null;
  sample_label_en: string | null;
  facts: ExposureFact[];
};

export type ExposureReport = {
  region_set: boolean;
  region_code: string | null;
  region_label: string | null;
  topics: ExposureTopic[];
};

export type ExposureRegionOption = {
  code: string;
  label: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFact(value: unknown): value is ExposureFact {
  if (!isRecord(value)) return false;
  return (
    (EXPOSURE_DAYS as readonly string[]).includes(String(value.day)) &&
    typeof value.code === "string" &&
    (value.subject === null || typeof value.subject === "string")
  );
}

function isTopic(value: unknown): value is ExposureTopic {
  if (!isRecord(value) || !isFactList(value.facts)) return false;
  const sources = ["dwd_heat", "dwd_uv", "dwd_pollen", "uba_air"];
  const reasons = ["none", "region_missing", "source_unreachable", "unexpected_document", "no_published_place"];
  return (
    (EXPOSURE_TOPICS as readonly string[]).includes(String(value.topic)) &&
    sources.includes(String(value.source_id)) &&
    (value.origin === "live" || value.origin === "synthetic") &&
    typeof value.licence === "string" &&
    typeof value.dataset_url === "string" &&
    (value.retrieved_at === null || typeof value.retrieved_at === "string") &&
    (value.source_timestamp === null || typeof value.source_timestamp === "string") &&
    typeof value.stale === "boolean" &&
    typeof value.place_label === "string" &&
    reasons.includes(String(value.reason)) &&
    (value.sample_label_de === null || typeof value.sample_label_de === "string") &&
    (value.sample_label_en === null || typeof value.sample_label_en === "string")
  );
}

function isFactList(value: unknown): value is ExposureFact[] {
  return Array.isArray(value) && value.every(isFact);
}

export function isExposureReport(value: unknown): value is ExposureReport {
  if (!isRecord(value) || !Array.isArray(value.topics) || !value.topics.every(isTopic)) return false;
  return (
    typeof value.region_set === "boolean" &&
    (value.region_code === null || typeof value.region_code === "string") &&
    (value.region_label === null || typeof value.region_label === "string")
  );
}

export function isRegionList(value: unknown): value is ExposureRegionOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) && typeof item.code === "string" && typeof item.label === "string",
    )
  );
}
