// lib/categories.ts
// One source of truth for how each category is named and coloured.

import type { EventCategory } from "./metrics";

export type CategoryStyle = {
  key: EventCategory;
  /** What the user sees. "waste"/"productive" are the model's words, not good UI words. */
  label: string;
  /** Short gloss shown in legends and pickers. */
  hint: string;
  text: string;
  bg: string;
  border: string;
  /** Solid fill for bars and the day ribbon. */
  fill: string;
};

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  productive: {
    key: "productive",
    label: "Signal",
    hint: "Moves your goals forward",
    text: "text-signal",
    bg: "bg-signal/10",
    border: "border-signal/40",
    fill: "bg-signal",
  },
  neutral: {
    key: "neutral",
    label: "Upkeep",
    hint: "Keeps life running",
    text: "text-upkeep",
    bg: "bg-upkeep/10",
    border: "border-upkeep/40",
    fill: "bg-upkeep",
  },
  waste: {
    key: "waste",
    label: "Noise",
    hint: "Distraction or avoidance",
    text: "text-noise",
    bg: "bg-noise/10",
    border: "border-noise/40",
    fill: "bg-noise",
  },
  sleep: {
    key: "sleep",
    label: "Rest",
    hint: "Sleep and naps",
    text: "text-rest",
    bg: "bg-rest/10",
    border: "border-rest/40",
    fill: "bg-rest",
  },
  untracked: {
    key: "untracked",
    label: "Unaccounted",
    hint: "Time you haven't described",
    text: "text-unknown",
    bg: "bg-unknown/10",
    border: "border-unknown/40",
    // Hatched rather than filled — absence of data should not look like a category.
    fill: "hatch-unknown",
  },
};

export const EDITABLE_CATEGORIES: EventCategory[] = [
  "productive",
  "neutral",
  "waste",
  "sleep",
  "untracked",
];

export function categoryStyle(raw: string | null | undefined): CategoryStyle {
  const key = (raw ?? "").toLowerCase() as EventCategory;
  return CATEGORY_STYLES[key] ?? CATEGORY_STYLES.untracked;
}
