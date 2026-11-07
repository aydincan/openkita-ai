export type LetterLanguage = "de" | "en" | "tr" | "ar";

export type Draft = {
  id: string;
  facility_id: string;
  author_display_name: string;
  subject: string;
  body: string;
  language: LetterLanguage;
  message_type: string;
  tone: string;
  status: "draft" | "approved";
  ai_generated: true;
  skill: string;
  skill_version: string;
  requires_human_review: boolean;
  warnings: string[];
  missing_information: { placeholder: string; question: string }[];
  key_facts: { label: string; value: string }[];
  created_at: string;
  updated_at: string;
};

const LANGUAGES = new Set(["de", "en", "tr", "ar"]);

export function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<Draft>;
  return (
    typeof draft.id === "string" &&
    typeof draft.subject === "string" &&
    typeof draft.body === "string" &&
    typeof draft.language === "string" &&
    LANGUAGES.has(draft.language) &&
    (draft.status === "draft" || draft.status === "approved") &&
    draft.ai_generated === true &&
    Array.isArray(draft.warnings) &&
    Array.isArray(draft.missing_information) &&
    Array.isArray(draft.key_facts)
  );
}
