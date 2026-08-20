"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Voice notes travel through the normal text message pipeline as
// "[voice]<url>". These helpers keep sender and receiver in sync.
export const VOICE_PREFIX = "[voice]";
export const isVoiceMessage = (text: string) => text.startsWith(VOICE_PREFIX);
export const voiceUrl = (text: string) => text.slice(VOICE_PREFIX.length);

// Playable bubble for a received/sent voice note.
export function VoiceNotePlayer({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <audio
      controls
      preload="none"
      src={voiceUrl(text)}
      className={cn("max-w-[240px] h-10", light && "invert-[0.05]")}
    />
  );
}

// Mic button: click to record, click again to stop — the note uploads and
// onRecorded(url) fires so the caller can send the "[voice]<url>" message.
export function VoiceRecorderButton({
  onRecorded,
  disabled = false,
}: {
  onRecorded: (url: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      // stop mic if the chat unmounts mid-recording
      try {
        recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setSeconds(0);

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return; // ignore accidental taps

        setUploading(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "voice-note.webm");
          const res = await fetch("/api/internal-chat/voice", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          await onRecorded(data.url);
        } catch (err: any) {
          alert("Could not send the voice note: " + (err?.message || "unknown error"));
        } finally {
          setUploading(false);
        }
      };
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access is needed for voice notes. Allow the microphone and try again.");
    }
  };

  const stop = () => {
    try {
      recorderRef.current?.stop();
    } catch {}
  };

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled || uploading}
      title={recording ? "Stop and send" : "Record a voice note"}
      aria-label={recording ? "Stop and send voice note" : "Record a voice note"}
      className={cn(
        "shrink-0 h-10 rounded-xl flex items-center justify-center gap-1.5 px-3 text-sm font-semibold transition-all",
        recording
          ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
          : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200",
        (disabled || uploading) && "opacity-60"
      )}
    >
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <>
          <Square className="h-3.5 w-3.5 fill-current" />
          {mm}:{ss}
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
