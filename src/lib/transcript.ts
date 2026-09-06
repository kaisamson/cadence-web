// lib/transcript.ts
//
// `days.transcript` is a text column, but the analyze route wrote a JS array to
// it. Supabase stringified that array, so rows landed as literal
// `["I woke up at 8:30..."]` — brackets and quotes rendered straight onto the
// day page. Worse, the read path saw a string and re-wrapped it, so each new
// recap nested the previous one another level deep.
//
// We keep the column as JSON text (no migration needed) and parse defensively,
// unwrapping however many layers of legacy nesting a row has accumulated.

const MAX_UNWRAP_DEPTH = 5;

export function parseTranscriptHistory(raw: unknown, depth = 0): string[] {
  if (raw == null || depth > MAX_UNWRAP_DEPTH) return [];

  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => parseTranscriptHistory(entry, depth + 1));
  }

  if (typeof raw !== "string") return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  // A row that was double-encoded looks like a JSON array; unwrap it.
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseTranscriptHistory(parsed, depth + 1);
      }
    } catch {
      // Not JSON after all — a recap that merely starts with a bracket.
    }
  }

  return [trimmed];
}

export function serializeTranscriptHistory(entries: string[]): string {
  return JSON.stringify(entries.map((e) => e.trim()).filter(Boolean));
}

/** Flatten history into the plain prose the model should read. */
export function transcriptToPrompt(entries: string[]): string {
  return entries
    .map((entry, i) => `[Recap ${i + 1}] ${entry}`)
    .join("\n\n");
}
