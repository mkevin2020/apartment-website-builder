"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

// Full-screen rotating attendance QR for an office screen.
// Employees scan it from inside the staff app to mark VERIFIED attendance.
// The code changes every minute and is signed, so a screenshot stops working.
export default function AttendanceDisplayPage() {
  const [qr, setQr] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const tokenRef = useRef<string>("");

  // Pull a fresh token and render it to a QR image
  const refresh = async () => {
    try {
      const res = await fetch("/api/attendance/qr-token", { cache: "no-store" });
      const data = await res.json();
      tokenRef.current = data.token;
      setSecondsLeft(Math.max(1, Math.round((data.expiresIn || 0) / 1000)));
      const url = await QRCode.toDataURL(data.token, { width: 420, margin: 1 });
      setQr(url);
    } catch {
      /* keep showing the last code */
    }
  };

  useEffect(() => {
    refresh();
    // Re-pull a little faster than the rotation so the screen is never stale
    const poll = setInterval(refresh, 20_000);
    const tick = setInterval(() => setSecondsLeft((s) => (s > 1 ? s - 1 : 1)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
      <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Cielo Vista — Staff Attendance</h1>
      <p className="text-slate-300 mb-8 text-center max-w-lg">
        Open the staff app → <span className="font-semibold text-white">Verify Attendance</span> → scan this code to
        mark yourself present.
      </p>

      <div className="bg-white rounded-3xl p-6 shadow-2xl">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Attendance QR code" width={420} height={420} />
        ) : (
          <div className="w-[420px] h-[420px] flex items-center justify-center text-slate-400">Loading…</div>
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm">This code refreshes automatically</p>
        <p className="text-2xl font-bold mt-1">New code in {secondsLeft}s</p>
      </div>
    </div>
  );
}
