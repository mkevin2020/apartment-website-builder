"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CameraOff, CheckCircle2, XCircle, Loader2, ScanLine, Search } from "lucide-react";

type Result = {
  valid: boolean;
  reason?: string;
  expired?: boolean;
  alreadyVerified?: boolean;
  justChecked?: boolean;
  verifiedAt?: string;
  checkedBy?: string | null;
  checkerWarning?: string | null;
  receiptId?: string;
  checkout?: string | null;
  details?: {
    reference: string;
    tenant: string;
    email: string;
    apartment: string;
    amount: number;
    currency: string;
    status: string;
    paidOn?: string;
    checkout?: string | null;
  };
};

// Reusable QR-ticket scanner + verifier. Used by reception staff and managers.
// `verifier` is the person checking the ticket in (their id is recorded as the checker).
// `onChecked` lets the parent refresh any "tickets checked" list after a successful check-in.
export function TicketScanner({
  verifier,
  onChecked,
}: {
  verifier?: { id: number | string; name?: string } | null;
  onChecked?: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const lastInput = useRef<{ token?: string; code?: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const verify = async (payload: { token?: string; code?: string; markUsed?: boolean; verifiedBy?: any }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/reception/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data);
      if (data?.justChecked) onChecked?.();
    } catch {
      setResult({ valid: false, reason: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  };

  const stopScan = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
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
          const text = found.data;
          stopScan();
          lastInput.current = { token: text };
          verify({ token: text });
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const startScan = async () => {
    setCameraError(null);
    setResult(null);

    if (typeof window !== "undefined" && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
      setCameraError(
        `The camera is blocked because this page isn't a secure context (current address: ${window.location.origin}). ` +
          "Open the app via https:// or http://localhost — a LAN IP over http (e.g. 192.168.x.x) will not allow the camera."
      );
      return;
    }

    setScanning(true);
    try {
      // Use the chosen camera (e.g. an external USB webcam) if one is selected,
      // otherwise prefer the back/environment camera.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      // Now that permission is granted, device labels become available.
      listCameras();
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      setScanning(false);
      const name = err?.name || "";
      if (name === "NotAllowedError") {
        setCameraError("Camera permission was blocked. Tap the 🔒 lock icon → Camera → Allow, then reload.");
      } else {
        setCameraError(
          name === "NotFoundError"
            ? "No camera was found on this device."
            : name === "NotReadableError"
              ? "The camera is in use by another app. Close it and try again."
              : `Could not start the camera: ${err?.message || String(err)}.`
        );
      }
    }
  };

  // List available cameras (labels only appear after camera permission is granted).
  const listCameras = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setCameras(all.filter((d) => d.kind === "videoinput"));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    listCameras();
    const md = navigator.mediaDevices;
    md?.addEventListener?.("devicechange", listCameras);
    return () => {
      md?.removeEventListener?.("devicechange", listCameras);
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user picks a different camera while scanning, restart with it.
  const switchCamera = async (id: string) => {
    setSelectedCameraId(id);
    if (scanning) {
      stopScan();
      // give the previous stream a tick to release before reopening
      setTimeout(() => startScan(), 150);
    }
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    lastInput.current = { code: code.trim() };
    setResult(null);
    verify({ code: code.trim() });
  };

  const checkIn = () => {
    if (!lastInput.current) return;
    verify({ ...lastInput.current, markUsed: true, verifiedBy: verifier?.id });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Scanner / input */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-500" /> Verify a Receipt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="relative">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full rounded-xl bg-black ${scanning ? "block" : "hidden"}`}
                style={{ maxHeight: 360, objectFit: "cover" }}
              />
              {scanning && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                </div>
              )}
            </div>
            {!scanning && (
              <div className="flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl py-10 text-slate-400">
                <Camera className="h-10 w-10 mb-2" />
                <p className="text-sm">Camera is off</p>
              </div>
            )}
            {cameraError && <p className="text-sm text-red-600 mt-2">{cameraError}</p>}

            {/* Camera picker — choose a built-in or external (USB) webcam */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Camera</label>
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Default camera</option>
                {cameras.map((c, i) => (
                  <option key={c.deviceId || i} value={c.deviceId}>
                    {c.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
              {cameras.length <= 1 && (
                <p className="text-xs text-slate-400 mt-1">
                  Start the camera once to allow access — your external webcam will then appear here to select.
                </p>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              {!scanning ? (
                <Button onClick={startScan} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Camera className="h-4 w-4 mr-2" /> Scan QR Code
                </Button>
              ) : (
                <Button onClick={stopScan} variant="outline" className="flex-1">
                  <CameraOff className="h-4 w-4 mr-2" /> Stop Camera
                </Button>
              )}
            </div>
          </div>

          {/* Manual code */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div>
            <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-900 px-3 text-xs text-slate-400 uppercase">or enter code</span></div>
          </div>
          <form onSubmit={submitCode} className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. PAY-2026-197693"
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !code.trim()}>
              <Search className="h-4 w-4 mr-1" /> Check
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle>Result</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin mb-3" /> Verifying…
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
              <ScanLine className="h-12 w-12 mb-3" />
              <p>Scan a QR code or enter a receipt code to check if it&apos;s valid.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.valid && !result.alreadyVerified ? (
                <Banner
                  color="green"
                  icon={<CheckCircle2 className="h-10 w-10" />}
                  title={result.justChecked ? "Checked In ✓" : "Valid Ticket"}
                  subtitle={
                    result.justChecked
                      ? `Checked by ${result.checkedBy || verifier?.name || "you"} — tenant notified to pay the balance`
                      : "Payment confirmed"
                  }
                />
              ) : result.valid && result.alreadyVerified ? (
                <Banner
                  color="red"
                  icon={<XCircle className="h-10 w-10" />}
                  title="Ticket Already Used — Expired"
                  subtitle={`This ticket was already checked in${result.checkedBy ? ` by ${result.checkedBy}` : ""}${result.verifiedAt ? ` on ${new Date(result.verifiedAt).toLocaleString()}` : ""}. It cannot be used again.`}
                />
              ) : result.expired ? (
                <Banner color="red" icon={<XCircle className="h-10 w-10" />} title="Receipt Expired" subtitle={result.checkout ? `Check-out was ${new Date(result.checkout).toLocaleDateString()} — apartment released` : "This stay has ended"} />
              ) : (
                <Banner color="red" icon={<XCircle className="h-10 w-10" />} title="Invalid" subtitle={result.reason || "This ticket is not valid"} />
              )}

              {result.checkerWarning && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  {result.checkerWarning}
                </div>
              )}

              {result.details && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  <Row label="Reference" value={result.details.reference} mono />
                  <Row label="Tenant" value={result.details.tenant} />
                  <Row label="Apartment" value={result.details.apartment} />
                  <Row label="Amount" value={`${result.details.currency} ${Number(result.details.amount).toLocaleString()}`} />
                  {result.details.checkout && <Row label="Check-out" value={new Date(result.details.checkout).toLocaleDateString()} />}
                  <Row label="Status" value={result.expired ? "expired" : result.alreadyVerified ? "used" : result.details.status} />
                  {result.details.paidOn && <Row label="Paid on" value={new Date(result.details.paidOn).toLocaleString()} />}
                </div>
              )}

              {result.valid && !result.alreadyVerified && !result.justChecked && (
                <Button onClick={checkIn} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Check In (mark as used)
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setResult(null)}>Verify Another</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Banner({ color, icon, title, subtitle }: { color: "green" | "red" | "amber"; icon: React.ReactNode; title: string; subtitle: string }) {
  const map = {
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  };
  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${map[color]}`}>
      {icon}
      <div>
        <p className="text-xl font-bold">{title}</p>
        <p className="text-sm opacity-90">{subtitle}</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-medium text-slate-900 dark:text-white ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
