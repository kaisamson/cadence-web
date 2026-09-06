# 🕒 Cadence — Own Your Time

Turn a spoken end-of-day recap into a structured timeline, honest metrics, and a
short list of things to change tomorrow.

Built by **Kai Samson**. Web only — desktop and mobile browser.

---

## How it works

1. **Record.** Tap the mic on `/today` and describe your day out loud. Audio is
   transcribed server-side (OpenAI), so it works reliably in Safari on iOS as
   well as desktop Chrome and Firefox.
2. **Structure.** A model turns the recap into a timeline of events, each
   categorised as signal, upkeep, noise, rest, or unaccounted.
3. **Measure.** The server computes metrics *from that timeline* — see below.
4. **Correct.** Tap any block to fix its label, category, or times. Or record a
   follow-up recap; it merges into the existing day rather than replacing it.

## Metrics are derived, not reported

The model produces the timeline. It never reports the numbers.

Every day is painted onto a 1440-minute canvas and the minutes are counted, so
totals always reconcile to exactly 24h and always match the timeline on screen.
Overlapping events resolve shortest-first, so a 15-minute scroll nested inside a
2-hour study block carves 15 minutes out of it instead of double-counting.

Unaccounted time is surfaced as its own number rather than silently dropped —
it is usually the most actionable figure on the page.

**Deep work hours** (productive time inside unbroken 45-minute-plus stretches)
is preferred over a raw block count: being interrupted three times turns one
three-hour stretch into three qualifying blocks, so a count rewards
fragmentation while these hours correctly fall.

## Stack

- Next.js 16 (App Router, RSC) · React 19 · TypeScript
- Tailwind v4 — theme tokens live in `src/app/globals.css`, not a config file
- Supabase Postgres
- OpenAI for transcription and timeline structuring

## Setup

```bash
npm install
npm run dev
```

`.env.local`:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Transcription + timeline structuring |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE` | Server-side DB access |
| `OWNER_ID` | The single user's UUID |
| `CADENCE_DASHBOARD_PASSWORD` | Login password |
| `CADENCE_AUTH_SECRET` | *Recommended.* HMAC key for session cookies. Falls back to the password if unset. |
| `CADENCE_TIMEZONE` | Default IANA zone (e.g. `America/Toronto`) used until the browser reports its own |
| `CADENCE_MODEL` | Optional. Defaults to `gpt-4.1-mini` |
| `CADENCE_TRANSCRIBE_MODEL` | Optional. Defaults to `gpt-4o-mini-transcribe` |

## Install on iPhone

Open the site in Safari → Share → **Add to Home Screen**. It runs standalone,
with its own icon and no browser chrome.

## Notes

- Auth is a signed, expiring HMAC cookie checked in `src/proxy.ts` for every
  route. A single shared password gates the whole app; there is one user.
- "Today" is resolved in the user's timezone, reported by the browser via
  cookie — the server clock (UTC on Vercel) is never used to decide the date.
