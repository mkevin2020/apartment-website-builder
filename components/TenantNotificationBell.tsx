"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { Bell, CreditCard, LogOut as LogOutIcon, X, AlertTriangle } from "lucide-react";

const DEPOSIT_RATE = 0.4;

interface Notif {
  id: string;
  kind: "balance" | "checkout" | "vacate";
  title: string;
  message: string;
  amount?: number; // exact amount to prefill for top-up (full balance, not 40%)
  apartmentId?: number; // so payment can be prefilled and decline can free it
  apartmentName?: string; // shown in the message
  bookingId?: number; // so decline can cancel the right booking
}

export function TenantNotificationBell({ tenantId }: { tenantId: string | number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const supabase = dataClient();

  const [toast, setToast] = useState<Notif | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Short two-tone chime, generated in the browser (no audio file needed).
  // Browsers may block sound before the first user interaction — fails silently.
  const playRing = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.7);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.75);
      });
    } catch {
      /* sound blocked — the visual toast still shows */
    }
  };

  // Ring + popup once per session for the same set of notifications, so the
  // tenant is actively alerted without being nagged on every page change.
  const announce = (list: Notif[]) => {
    if (list.length === 0) return;
    const key = list.map((n) => n.id).sort().join(",");
    if (sessionStorage.getItem("tenant_notif_rung") === key) return;
    sessionStorage.setItem("tenant_notif_rung", key);
    playRing();
    setToast(list[0]);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 12000);
  };

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      // Latest booking for this tenant
      const { data: bks } = await supabase
        .from("bookings")
        .select("*")
        .eq("tenant_id", String(tenantId))
        .order("start_date", { ascending: false })
        .limit(1);
      const booking = bks?.[0];
      if (!booking) return;

      // Payments for this tenant
      const { data: pays } = await supabase
        .from("tenant_payments")
        .select("*")
        .eq("tenant_id", tenantId);
      const payments = pays || [];

      const completedPaid = payments
        .filter((p: any) => p.status === "completed")
        .reduce((s: any, p: any) => s + (Number(p.amount) || 0), 0);

      // Derive the booking total from the booking payment.
      // New bookings store the FULL amount (ref "BKG-"); legacy ones stored a 40%
      // deposit (ref "DEP-"), so divide those by the deposit rate to recover the total.
      const bookingPay = payments.find((p: any) => {
        const ref = String(p.reference_number || "");
        return ref.startsWith("BKG-") || ref.startsWith("DEP-");
      });
      let total = 0;
      if (bookingPay) {
        const ref = String(bookingPay.reference_number || "");
        const amt = Number(bookingPay.amount) || 0;
        total = ref.startsWith("DEP-") ? amt / DEPOSIT_RATE : amt;
      }

      // Always look up the apartment so we can name it (and fall back to its price)
      let apartmentName = "your apartment";
      let apartmentReleased = false;
      if (booking.apartment_id) {
        const { data: apt } = await supabase
          .from("apartments")
          .select("name, price_per_month, is_available")
          .eq("id", booking.apartment_id)
          .single();
        if (apt?.name) apartmentName = apt.name;
        if (!total) total = Number(apt?.price_per_month) || 0;
        // The manager marked this unit available again while the tenant is still
        // confirmed in it — that is the "you must move out" signal.
        apartmentReleased = apt?.is_available === true;
      }

      const remaining = Math.max(0, Math.round(total - completedPaid));

      // Has the receptionist checked (verified) this tenant's ticket?
      // Receipts link to the payment (tenant_payment_id), not always tenant_id — so match on payment ids.
      const paymentIds = payments.map((p: any) => p.id).filter(Boolean);
      let ticketChecked = false;
      if (paymentIds.length > 0) {
        const { data: vr } = await supabase
          .from("receipts")
          .select("id")
          .in("tenant_payment_id", paymentIds)
          .eq("is_verified", true)
          .limit(1);
        ticketChecked = !!(vr && vr.length > 0);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkIn = booking.start_date ? new Date(booking.start_date + "T00:00:00") : null;
      const checkOut = booking.end_date ? new Date(booking.end_date + "T00:00:00") : null;

      const list: Notif[] = [];

      // 1) Balance due — triggered when the ticket is checked at reception OR check-in date arrives
      if (remaining > 0 && (ticketChecked || (checkIn && today >= checkIn))) {
        list.push({
          id: "balance",
          kind: "balance",
          title: ticketChecked ? "Ticket checked — pay your balance" : "Pay your remaining balance",
          message: ticketChecked
            ? `Your ticket for ${apartmentName} has been checked at reception. Please pay the remaining balance of RWF ${remaining.toLocaleString()} to keep it. Accept to pay now, or decline to give up the apartment.`
            : `Your stay at ${apartmentName} has started. Please pay the remaining balance of RWF ${remaining.toLocaleString()} to keep it. Accept to pay now, or decline to give up the apartment.`,
          amount: remaining,
          apartmentId: booking.apartment_id,
          apartmentName,
          bookingId: booking.id,
        });
      }

      // 2) Check-out date reached
      if (checkOut && today >= checkOut) {
        // If the tenant already accepted and paid (a completed payment on/after the
        // check-out date), turn that money into extra stay time instead of nagging.
        const paidTopUp = payments.some(
          (p: any) =>
            p.status === "completed" &&
            p.apartment_id === booking.apartment_id &&
            String(p.payment_date || "") >= String(booking.end_date)
        );
        let stayExtended = false;
        if (paidTopUp) {
          try {
            const res = await fetch("/api/tenant/extend-stay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tenantId, bookingId: booking.id }),
            });
            const data = await res.json().catch(() => null);
            const newEnd = data?.newEndDate ? new Date(data.newEndDate + "T00:00:00") : null;
            stayExtended = !!(res.ok && newEnd && newEnd > today);
          } catch {
            /* network hiccup — the notice stays until the next 30s refresh */
          }
        }
        if (!stayExtended) {
          list.push({
            id: "checkout",
            kind: "checkout",
            title: "Check-out date reached",
            message: `Your check-out date for ${apartmentName} (${checkOut.toLocaleDateString()}) has arrived. Accept to top up and extend your stay, or decline to check out and release the apartment.`,
            amount: remaining > 0 ? remaining : undefined,
            apartmentId: booking.apartment_id,
            apartmentName,
            bookingId: booking.id,
          });
        }
      }

      // 3) Manager released the unit while this tenant is still confirmed in it.
      // Declining sets the booking to "cancelled", so an apartment the tenant gave
      // up themselves never lands here — only a manager-initiated release does.
      //
      // The stay must actually be RUNNING today. Old confirmed bookings are left
      // behind on apartments that were later freed, and without this window every
      // one of them would raise a bogus "move out" notice with no manager action.
      const stayRunning = !!checkIn && today >= checkIn && (!checkOut || today <= checkOut);
      if (booking.status === "confirmed" && apartmentReleased && stayRunning) {
        list.push({
          id: "vacate",
          kind: "vacate",
          title: "You must move out of this apartment",
          message: `The manager has released ${apartmentName} and marked it available to other clients. You are required to vacate the apartment. Please contact the manager if you believe this is a mistake.`,
          apartmentId: booking.apartment_id,
          apartmentName,
          bookingId: booking.id,
        });
      }

      setNotifs(list);
      announce(list);
    };

    load();
    // Re-check every 30s so a notification arriving while the tenant is on the
    // dashboard rings the bell without needing a page reload.
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const [declining, setDeclining] = useState<string | null>(null);

  const topUp = (n: Notif) => {
    // Accept → go to payment with the amount AND apartment already filled in,
    // so the tenant doesn't have to pick the apartment or type the amount again.
    const params = new URLSearchParams({ action: "pay" });
    if (n.amount) params.set("amount", String(n.amount));
    if (n.apartmentId) params.set("apartment_id", String(n.apartmentId));
    router.push(`/tenant/payments?${params.toString()}`);
    setOpen(false);
  };

  const declineApartment = async (n: Notif) => {
    if (
      !confirm(
        `Decline ${n.apartmentName || "this apartment"}? You will give it up and it will be released and made available to others. This cannot be undone.`
      )
    )
      return;
    setDeclining(n.id);
    try {
      const res = await fetch("/api/tenant/decline-apartment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, bookingId: n.bookingId, apartmentId: n.apartmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decline");
      setNotifs((prev) => prev.filter((x) => x.id !== n.id));
      alert(`You declined ${n.apartmentName || "the apartment"}. It has been released and is now available.`);
    } catch (e: any) {
      alert("Could not decline: " + (e?.message || "Unknown error"));
    } finally {
      setDeclining(null);
    }
  };

  const count = notifs.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-full transition-colors ${
          count > 0
            ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
            : "text-slate-600 hover:text-green-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
        aria-label={`${count} notifications`}
        title={count > 0 ? `${count} action(s) needed` : "Notifications"}
      >
        <Bell className={`w-5 h-5 ${count > 0 ? "animate-bounce" : ""}`} />
        {count > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white font-bold" style={{ fontSize: "9px" }}>
              {count}
            </span>
          </>
        )}
      </button>

      {/* Auto-popup when a notification arrives (rings + shows itself) */}
      {toast && !open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 animate-bounce" /> New notification
            </span>
            <button onClick={() => setToast(null)} className="text-white/80 hover:text-white" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="font-semibold text-sm text-slate-900 dark:text-white">{toast.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">{toast.message}</p>
            <button
              onClick={() => { setToast(null); setOpen(true); }}
              className="mt-3 w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2 transition-colors"
            >
              View details
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {count === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">You&apos;re all caught up 🎉</p>
            ) : (
              notifs.map((n) => (
                <div key={n.id} className="p-4">
                  <div className="flex items-start gap-2">
                    {n.kind === "checkout" ? (
                      <LogOutIcon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{n.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{n.message}</p>
                      {/* A vacate order isn't negotiable from here — paying or
                          declining makes no sense, so it carries no actions. */}
                      {n.kind !== "vacate" && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => topUp(n)}
                            disabled={declining === n.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {n.kind === "checkout" ? "Accept & Top Up" : "Accept & Pay"}
                          </button>
                          {n.apartmentId && (
                            <button
                              onClick={() => declineApartment(n)}
                              disabled={declining === n.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-xs font-semibold px-3 py-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                              {declining === n.id ? "Declining…" : "Decline"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
