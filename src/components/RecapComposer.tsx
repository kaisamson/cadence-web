"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nowLocalTime } from "@/lib/time";

type Props = {
  date: string;
  /** "create" navigates to the new day; "append" refreshes the current one. */
  mode: "create" | "append";
  placeholder?: string;
};

/** Browsers disagree on container support; iOS Safari only does mp4. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("aac")) return "aac";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

const MAX_RECORDING_SECONDS = 300;

export function RecapComposer({ date, mode, placeholder }: Props) {
  const router = useRouter();

  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<
    "idle" | "recording" | "transcribing" | "analyzing"
  >("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const busy = status === "transcribing" || status === "analyzing";

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  // Release the mic if the user navigates away mid-recording.
  useEffect(() => teardown, [teardown]);

  async function sendToTranscription(blob: Blob, mime: string) {
    setStatus("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, `recap.${extensionFor(mime)}`);

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(body.error || `Transcription failed (${res.status})`);

      // Append rather than replace: the old implementation overwrote the box,
      // destroying anything already typed.
      setTranscript((prev) => {
        const next = prev.trim() ? `${prev.trim()} ${body.text}` : body.text;
        return next;
      });
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setStatus("idle");
    }
  }

  async function startRecording() {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. You can type your recap instead.");
      return;
    }

    const mime = pickMimeType();
    if (!mime) {
      setError("Audio recording isn't supported here. You can type your recap instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Live input level, so it's obvious the mic is actually hearing you.
      try {
        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtor();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 70));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* Meter is decorative — recording continues without it. */
      }

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        teardown();
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size > 0) void sendToTranscription(blob, mime);
        else setStatus("idle");
      };

      recorder.start();
      setStatus("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      teardown();
      setError("Microphone access was blocked. Allow it in your browser settings, or type instead.");
      setStatus("idle");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
  }

  async function analyze() {
    const text = transcript.trim();
    if (!text) {
      setError("Record or type something about your day first.");
      return;
    }

    setStatus("analyzing");
    setError(null);

    try {
      const res = await fetch("/api/analyze-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sent so the model can resolve "just now" and "the last 20 minutes".
        body: JSON.stringify({ date, transcript: text, nowLocalTime: nowLocalTime() }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status})`);

      setTranscript("");

      if (mode === "create" && body.dayId) router.push(`/day/${body.dayId}`);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setStatus("idle");
    }
  }

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={status === "recording" ? stopRecording : startRecording}
          disabled={busy}
          aria-label={status === "recording" ? "Stop recording" : "Start recording"}
          className={[
            // 56px circle: a comfortable one-thumb target
            "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40",
            status === "recording"
              ? "bg-noise text-white"
              : "bg-ink text-canvas hover:opacity-90",
          ].join(" ")}
        >
          {status === "recording" && (
            <span
              className="absolute inset-0 rounded-full bg-noise/40"
              style={{ transform: `scale(${1 + level * 0.5})`, transition: "transform 90ms linear" }}
            />
          )}
          <span className="relative">
            {status === "recording" ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">
            {status === "recording"
              ? `Recording · ${mmss}`
              : status === "transcribing"
              ? "Transcribing…"
              : status === "analyzing"
              ? "Building your timeline…"
              : transcript.trim()
              ? "Add more, or save below"
              : "Tap to record your recap"}
          </div>
          {status !== "recording" && (
            <p className="mt-0.5 text-xs text-ink-muted">
              {mode === "append"
                ? "Merges into the existing timeline."
                : "Say when you woke up, what you did, and how you slept."}
            </p>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={4}
        disabled={busy}
        placeholder={
          placeholder ??
          "Woke up at 9, scrolled for 30 min, worked 11–2, gym at 3, got about 7 hours of sleep…"
        }
        className="mt-3 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-line-strong disabled:opacity-50"
      />

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-noise/40 bg-noise/10 px-3 py-2 text-xs text-noise"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={analyze}
        disabled={busy || status === "recording" || !transcript.trim()}
        className="mt-3 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-30"
      >
        {status === "analyzing"
          ? "Building your timeline…"
          : mode === "append"
          ? "Update this day"
          : "Analyze & save day"}
      </button>
    </div>
  );
}
