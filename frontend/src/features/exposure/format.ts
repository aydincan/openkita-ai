import { fill, type Messages } from "@/lib/i18n";
import type { ExposureFact, ExposureReport, ExposureTopic, ExposureTopicName } from "@/types/exposure";

const HEAT = ["keine", "gering", "maessig", "stark", "extrem", "no_data"] as const;
const POLLEN_LEVELS = ["0", "0-1", "1", "1-2", "2", "2-3", "3"] as const;
const POLLEN_TYPES = ["Hasel", "Erle", "Esche", "Birke", "Graeser", "Roggen", "Beifuss", "Ambrosia"] as const;

function isHeat(code: string): code is (typeof HEAT)[number] {
  return (HEAT as readonly string[]).includes(code);
}

function isPollenLevel(code: string): code is (typeof POLLEN_LEVELS)[number] {
  return (POLLEN_LEVELS as readonly string[]).includes(code);
}

function isPollenType(code: string): code is (typeof POLLEN_TYPES)[number] {
  return (POLLEN_TYPES as readonly string[]).includes(code);
}

export function formatFact(topic: ExposureTopicName, fact: ExposureFact, messages: Messages): string {
  const copy = messages.exposure;
  if (fact.code.startsWith("sample_")) {
    const key = fact.code.slice("sample_".length);
    if (key === "heat" || key === "uv" || key === "pollen" || key === "air") {
      return copy.sampleFacts[key];
    }
  }
  if (fact.code.startsWith("published:")) return fact.code.slice("published:".length);
  if (topic === "heat" && isHeat(fact.code)) return copy.heat[fact.code];
  if (topic === "uv" && fact.code === "no_data") return copy.uv.noData;
  if (topic === "uv" && /^\d+$/.test(fact.code)) return fill(copy.uv.value, { n: fact.code });
  if (topic === "air" && fact.code === "no_data") return copy.air.noData;
  if (topic === "air" && /^\d+$/.test(fact.code)) return fill(copy.air.value, { n: fact.code });
  if (topic === "pollen") {
    if (fact.subject === null && fact.code === "0") return copy.pollenNone;
    const level = isPollenLevel(fact.code) ? copy.pollenLevels[fact.code] : fact.code;
    const subject =
      fact.subject !== null && isPollenType(fact.subject) ? copy.pollenTypes[fact.subject] : fact.subject;
    return subject ? `${subject}: ${level}` : level;
  }
  return fact.code;
}

export function sampleLabel(topic: ExposureTopic, locale: "de" | "en", messages: Messages): string | null {
  if (topic.origin !== "synthetic") return null;
  if (locale === "en") return topic.sample_label_en ?? messages.exposure.sample;
  return topic.sample_label_de ?? messages.exposure.sample;
}

export function parentNoteFacts(report: ExposureReport, messages: Messages, locale: "de" | "en"): string {
  const lines = [messages.exposure.draftPreface];
  for (const topic of report.topics) {
    if (topic.topic !== "heat" && topic.topic !== "pollen") continue;
    const bits = topic.facts.map(
      (fact) => `${messages.exposure.days[fact.day]}: ${formatFact(topic.topic, fact, messages)}`,
    );
    const marker = sampleLabel(topic, locale, messages);
    const suffix = marker ? ` (${marker})` : "";
    lines.push(`${messages.exposure.topics[topic.topic]}: ${bits.join("; ")}${suffix}`);
  }
  lines.push(messages.exposure.draftNotSent);
  return lines.join("\n").slice(0, 1500);
}
