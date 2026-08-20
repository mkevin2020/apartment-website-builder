"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, CheckCircle2, XCircle, ScanLine, Loader2 } from "lucide-react";

// Lets an employee mark VERIFIED attendance by scanning the office QR code
// (shown on the office screen at /attendance/display).
export function EmployeeClockIn({ employee }: { employee: any }) {
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  // On open, record today's clock-in. If we're on the office Wi-Fi the server
  // auto-verifies us (no scanning needed); otherwise we offer the QR scan.
  useEffect(() => {
    if (!employee?.id) return;
    fetch("/api/attendance/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "in" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.verified) setVerified(true);
      })
      .catch(() => {});
  }, [employee?.id]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => () => stop(), []);

  const submitToken = async (token: string) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "in", token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || "Could not verify attendance." });
      } else {
        setVerified(true);
        setResult({ ok: true, msg: "Attendance verified ✓ — you've been marked present at the office." });
      }
    } catch {
      setResult({ ok: false, msg: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current || (canvasRef.current = document.createElement("canvas"));
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (found && found.data) {
          stop();
          submitToken(found.data.trim());
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const start = async () => {
    setCameraError(null);
    setResult(null);
    if (typeof window !== "undefined" && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
      setCameraError("Camera needs https:// or http://localhost. Open the app that way and try again.");
      return;
    }
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      setScanning(false);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow it (lock icon → Camera) and try again."
          : `Could not start the camera: ${err?.message || String(err)}`,
      );
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-indigo-600" /> Attendance
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {verified
              ? "You're confirmed present at the office today."
              : "Scan the office QR code (on the reception screen) to confirm you're here."}
          </p>
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" /> Verified present
          </span>
        ) : !scanning ? (
          <Button onClick={start} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {busy ? "Verifying…" : "Scan office code"}
          </Button>
        ) : (
          <Button onClick={stop} variant="outline" className="gap-2">
            <CameraOff className="h-4 w-4" /> Stop
          </Button>
        )}
      </div>

      {scanning && (
        <div className="relative mt-4">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full max-w-sm mx-auto rounded-xl bg-black"
            style={{ maxHeight: 320, objectFit: "cover" }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-44 h-44 border-2 border-white/80 rounded-xl" />
          </div>
        </div>
      )}

      {cameraError && <p className="text-sm text-red-600 mt-3">{cameraError}</p>}

      {result && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            result.ok
              ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
          }`}
        >
          {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {result.msg}
        </div>
      )}
    </div>
  );
}
