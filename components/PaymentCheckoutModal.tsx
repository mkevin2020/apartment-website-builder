"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  CreditCard,
  Smartphone,
  Lock,
  Loader,
  CheckCircle,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY ||
  "";
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null);

// Styling for the Stripe-hosted card inputs so they match the design's
// light rounded fields.
const ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      fontWeight: "600",
      color: "#0f172a",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: { color: "#dc2626" },
  },
};

interface CheckoutPayment {
  id: number;
  amount: number;
  reference_number: string;
  due_date: string;
}

function PayPalButtons({
  payment,
  tenantId,
  onComplete,
  setError,
}: {
  payment: CheckoutPayment;
  tenantId: string;
  onComplete: () => void;
  setError: (s: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // The parent recreates these callbacks on every render; going through refs
  // keeps them out of the render effect's deps so the PayPal buttons are not
  // torn down and redrawn (visible flicker) each time the modal re-renders.
  const onCompleteRef = useRef(onComplete);
  const setErrorRef = useRef(setError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    setErrorRef.current = setError;
  });

  useEffect(() => {
    // Load PayPal SDK if not present
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb";
    const currency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || "USD";
    if ((window as any).paypal) {
      setLoaded(true);
      return;
    }

    // The script tag may already be in the DOM but still downloading, so
    // always wait for its load event instead of assuming it's ready.
    let s = document.querySelector<HTMLScriptElement>(`script[src*="paypal.com/sdk/js"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}`;
      s.async = true;
      document.body.appendChild(s);
    }
    const onLoad = () => setLoaded(true);
    const onError = () => setErrorRef.current("Failed to load PayPal SDK");
    s.addEventListener("load", onLoad);
    s.addEventListener("error", onError);
    return () => {
      s.removeEventListener("load", onLoad);
      s.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const paypal = (window as any).paypal;
    if (!paypal) {
      setErrorRef.current("PayPal SDK not available");
      return;
    }

    const buttons = paypal.Buttons({
      createOrder: async () => {
        try {
          const res = await fetch("/api/payments/paypal/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: payment.id, amount: payment.amount, tenantId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not create PayPal order");
          return data.orderID;
        } catch (e: any) {
          setErrorRef.current(e.message || "Create order failed");
          throw e;
        }
      },
      onApprove: async (data: any, actions: any) => {
        try {
          const res = await fetch("/api/payments/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID: data.orderID, paymentId: payment.id }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Capture failed");
          onCompleteRef.current();
        } catch (e: any) {
          setErrorRef.current(e.message || "Capture failed");
        }
      },
      onError: (err: any) => {
        setErrorRef.current(err?.message || "PayPal checkout failed");
      },
    });

    buttons
      .render(containerRef.current)
      .catch((e: any) => setErrorRef.current(e.message || "Render failed"));

    return () => {
      try {
        buttons.close();
      } catch {}
    };
  }, [loaded, payment.id, payment.amount, tenantId]);

  return (
    <div>
      {!loaded && (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader className="h-5 w-5 animate-spin" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}

interface PaymentCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  payment: CheckoutPayment;
  tenantId: string;
  onSuccess?: () => void;
}

// Prefill helpers: the tenant is logged in, so their email/phone are already
// known — the fields start filled and stay editable.
function loggedInTenant(): { email: string; phone: string } {
  try {
    const raw = localStorage.getItem("tenant_session");
    if (!raw) return { email: "", phone: "" };
    const t = JSON.parse(raw);
    return { email: t.email || "", phone: t.phone || "" };
  } catch {
    return { email: "", phone: "" };
  }
}

// "0798906754" / "+250798906754" → "798906754" (the field shows +250 already)
function localPhoneDigits(raw: string): string {
  let p = String(raw).replace(/[^0-9]/g, "");
  if (p.startsWith("250")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

type Method = "card" | "momo" | "paypal";
type MomoStage = "form" | "waiting" | "success" | "failed";

// Two-panel checkout dialog (AceCoinPay-style): payment form on the left,
// order summary + virtual card on the right. Card payments go through
// Stripe's secure hosted page; MTN MoMo asks for the phone number and waits
// for the customer to confirm on their phone.
export function PaymentCheckoutModal({
  open,
  onClose,
  payment,
  tenantId,
  onSuccess,
}: PaymentCheckoutModalProps) {
  const [method, setMethod] = useState<Method>("momo");
  const [phone, setPhone] = useState(() => localPhoneDigits(loggedInTenant().phone));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [momoStage, setMomoStage] = useState<MomoStage>("form");
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session countdown (like the 01:19 timer in the design)
  useEffect(() => {
    if (!open) return;
    setSecondsLeft(15 * 60);
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Reset state each time the dialog opens
  useEffect(() => {
    if (open) {
      setMethod("momo");
      setError("");
      setMomoStage("form");
      setLoading(false);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open]);

  if (!open) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const payWithMomo = async () => {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 9) {
      setError("Enter a valid MTN phone number (e.g. 078xxxxxxx)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/mtn-momo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          phone: digits,
          amount: payment.amount,
          tenantId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start MoMo payment");

      setMomoStage("waiting");
      // Poll until the customer confirms (or 2 minutes pass)
      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const sres = await fetch(`/api/payments/mtn-momo/status?tid=${data.transactionId}`);
          const sdata = await sres.json();
          if (sdata.status === "completed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setMomoStage("success");
            setTimeout(() => {
              onSuccess?.();
              onClose();
            }, 2500);
          } else if (sdata.status === "failed" || Date.now() - startedAt > 120000) {
            if (pollRef.current) clearInterval(pollRef.current);
            setMomoStage("failed");
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Failed to start MoMo payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Elements stripe={stripePromise}>
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-950 shadow-2xl overflow-y-auto overflow-x-hidden">
        <button
          onClick={onClose}
          aria-label="Close checkout"
          className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-[1.4fr_1fr]">
          {/* ── Left: payment form ─────────────────────────────── */}
          <div className="p-6 sm:p-8">
            {/* Brand + timer */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  Cielo<span className="text-blue-600">Pay</span>
                </span>
              </div>
              <div className="flex items-center gap-1" title="Session time remaining">
                {[mm[0], mm[1], ":", ss[0], ss[1]].map((ch, i) =>
                  ch === ":" ? (
                    <span key={i} className="font-bold text-slate-400">:</span>
                  ) : (
                    <span
                      key={i}
                      className="h-7 w-6 rounded-md bg-slate-900 dark:bg-slate-800 text-white text-sm font-bold flex items-center justify-center"
                    >
                      {ch}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Method toggle */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button
                onClick={() => { setMethod("momo"); setError(""); }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
                  method === "momo"
                    ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                )}
              >
                <Smartphone className="h-4 w-4" /> MTN MoMo
              </button>
              <button
                onClick={() => { setMethod("card"); setError(""); }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
                  method === "card"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                )}
              >
                <CreditCard className="h-4 w-4" /> Card
              </button>
              <button
                onClick={() => { setMethod("paypal"); setError(""); }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
                  method === "paypal"
                    ? "border-sky-700 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                )}
              >
                <span className="font-semibold">PayPal</span>
              </button>
            </div>

            {/* ── MoMo form ── */}
            {method === "momo" && momoStage === "form" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-900 dark:text-white">
                    MTN Phone Number
                  </label>
                  <p className="text-xs text-slate-400 mb-2">
                    The number that will confirm the payment
                  </p>
                  <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 px-4">
                    <span className="text-sm font-semibold text-slate-500 mr-2">+250</span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="78 890 67 54"
                      value={phone}
                      maxLength={9}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(""); }}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-12 px-0 text-base font-semibold tracking-wide"
                    />
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 p-3">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}
                <Button
                  onClick={payWithMomo}
                  disabled={loading}
                  className="w-full h-13 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base"
                >
                  {loading ? (
                    <><Loader className="h-4 w-4 mr-2 animate-spin" /> Requesting…</>
                  ) : (
                    "Pay Now"
                  )}
                </Button>
              </div>
            )}

            {/* ── MoMo waiting / result ── */}
            {method === "momo" && momoStage !== "form" && (
              <div className="flex flex-col items-center text-center py-6 space-y-4">
                {momoStage === "waiting" && (
                  <>
                    <div className="relative">
                      <Smartphone className="h-14 w-14 text-yellow-500" />
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-400 animate-ping" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Confirm on your phone
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        A payment request was sent to <strong>+250 {phone}</strong>.
                        <br />
                        Enter your MoMo PIN to approve it.
                      </p>
                    </div>
                    <Loader className="h-5 w-5 animate-spin text-slate-400" />
                  </>
                )}
                {momoStage === "success" && (
                  <>
                    <CheckCircle className="h-14 w-14 text-green-500" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Payment received!</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Your rent payment was completed successfully.
                      </p>
                    </div>
                  </>
                )}
                {momoStage === "failed" && (
                  <>
                    <AlertCircle className="h-14 w-14 text-red-500" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Payment not completed</p>
                      <p className="text-sm text-slate-500 mt-1">
                        The request was declined or timed out. You can try again.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setMomoStage("form")}>
                      Try again
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Card form (inline Stripe Elements) ── */}
            {method === "card" && !stripePublishableKey && (
              <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-4 mb-4 text-sm">
                Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or NEXT_PUBLIC_STRIPE_PUBLIC_KEY in your environment.
              </div>
            )}
            {method === "card" && stripePublishableKey && (
              <CardForm
                payment={payment}
                tenantId={tenantId}
                onComplete={() => {
                  setTimeout(() => {
                    onSuccess?.();
                    onClose();
                  }, 2500);
                }}
              />
            )}

            {/* ── PayPal buttons ── */}
            {method === "paypal" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Pay securely with your PayPal account. The amount is charged in USD.
                </p>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 p-3">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}
                <PayPalButtons
                  payment={payment}
                  tenantId={tenantId}
                  setError={setError}
                  onComplete={() => {
                    setTimeout(() => {
                      onSuccess?.();
                      onClose();
                    }, 1500);
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Right: summary panel ───────────────────────────── */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 sm:p-8 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800">
            {/* Virtual card / MoMo badge */}
            {method === "card" ? (
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 shadow-lg mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-6 w-8 rounded bg-yellow-300/90" />
                  <Wifi className="h-4 w-4 rotate-90 opacity-80" />
                </div>
                <p className="text-sm tracking-[0.2em] font-semibold opacity-90">
                  •••• •••• •••• ••••
                </p>
                <div className="flex items-center justify-between mt-3 text-xs opacity-80">
                  <span>CIELO VISTA TENANT</span>
                  <div className="flex -space-x-2">
                    <span className="h-5 w-5 rounded-full bg-red-500/90" />
                    <span className="h-5 w-5 rounded-full bg-yellow-400/90" />
                  </div>
                </div>
              </div>
            ) : method === "paypal" ? (
              <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-blue-800 text-white p-4 shadow-lg mb-6">
                <p className="font-extrabold text-lg italic">
                  Pay<span className="text-sky-300">Pal</span>
                </p>
                <p className="text-xs font-medium mt-1 opacity-80">Secure online payment</p>
                <p className="text-sm font-bold mt-4 tracking-wide">Charged in USD</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-slate-900 p-4 shadow-lg mb-6">
                <p className="font-extrabold text-lg">MTN MoMo</p>
                <p className="text-xs font-medium mt-1 opacity-80">Mobile Money · Rwanda</p>
                <p className="text-sm font-bold mt-4 tracking-wide">
                  {phone ? `+250 ${phone}` : "+250 •• ••• •• ••"}
                </p>
              </div>
            )}

            {/* Order details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Company</span>
                <span className="font-semibold text-slate-900 dark:text-white">Cielo Vista</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {payment.reference_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due date</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatDate(payment.due_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Product</span>
                <span className="font-semibold text-slate-900 dark:text-white">Rent payment</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-1">You have to pay</p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrency(payment.amount)}
                <span className="text-base font-semibold text-slate-400 ml-1.5">RWF</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Elements>
  );
}

// Inline card payment form. The card number / expiry / CVV boxes are secure
// Stripe-hosted fields rendered inside our design — card data goes directly
// to Stripe, never through our server.
function CardForm({
  payment,
  tenantId,
  onComplete,
}: {
  payment: CheckoutPayment;
  tenantId: string;
  onComplete: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState(() => loggedInTenant().email);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  const payNow = async () => {
    if (!stripe || !elements) return;
    if (!email.trim()) {
      setError("Enter your email to receive the receipt");
      return;
    }
    const cardEl = elements.getElement(CardNumberElement);
    if (!cardEl) return;

    setLoading(true);
    setError("");
    try {
      // 1) Create the PaymentIntent on our server
      const res = await fetch("/api/payments/stripe-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, amount: payment.amount, tenantId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start card payment");

      // 2) Confirm with the card details (handled by Stripe's secure fields)
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardEl,
          billing_details: { email },
        },
        receipt_email: email,
      });
      if (result.error) throw new Error(result.error.message || "Card was declined");

      // 3) Server-side verification marks the invoice paid
      const confirmRes = await fetch("/api/payments/stripe-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: result.paymentIntent.id,
          paymentId: payment.id,
        }),
      });
      if (!confirmRes.ok) {
        const cdata = await confirmRes.json();
        throw new Error(cdata.error || "Could not verify the payment");
      }

      setPaid(true);
      onComplete();
    } catch (err: any) {
      setError(err.message || "Card payment failed");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <div className="flex flex-col items-center text-center py-6 space-y-4">
        <CheckCircle className="h-14 w-14 text-green-500" />
        <div>
          <p className="font-bold text-slate-900 dark:text-white">Payment received!</p>
          <p className="text-sm text-slate-500 mt-1">Your rent payment was completed successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-900 dark:text-white">Card Number</label>
        <p className="text-xs text-slate-400 mb-2">Enter the 16-digit card number on the card</p>
        <div className="rounded-xl bg-slate-100 px-4 py-3.5">
          <CardNumberElement options={{ ...ELEMENT_OPTIONS, showIcon: true }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-900 dark:text-white">CVV Number</label>
          <p className="text-xs text-slate-400 mb-2">The 3 digits on the back</p>
          <div className="rounded-xl bg-slate-100 px-4 py-3.5">
            <CardCvcElement options={ELEMENT_OPTIONS} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-900 dark:text-white">Expiry Date</label>
          <p className="text-xs text-slate-400 mb-2">MM / YY</p>
          <div className="rounded-xl bg-slate-100 px-4 py-3.5">
            <CardExpiryElement options={ELEMENT_OPTIONS} />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 dark:text-white">Receipt Email</label>
        <p className="text-xs text-slate-400 mb-2">Your receipt is sent to this address</p>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          className="h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border-0 text-base font-semibold"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 p-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={payNow}
        disabled={loading || !stripe}
        className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base"
      >
        {loading ? (
          <><Loader className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
        ) : (
          "Pay Now"
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Lock className="h-3.5 w-3.5" />
        <span>Secured by Stripe — card details never touch our servers</span>
      </div>
    </div>
  );
}
