"use client";

import Image from "next/image";
import { Mail, MapPin, CheckCircle2 } from "lucide-react";

export interface InvoiceItem {
  description: string;
  rate: number;
  unit: string;
  subtotal: number;
}

export interface InvoiceReceiptProps {
  invoiceNumber: string;
  referenceNumber: string;
  date: string;
  dueDate?: string;
  billedToName: string;
  billedToEmail?: string;
  billedToPhone?: string;
  qrCodeBase64?: string;
  transactionId?: string;
  currency: string;
  items: InvoiceItem[];
  isVerified?: boolean;
}

const fmtDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })
    : "";

const fmtMoney = (n: number) => n.toLocaleString();

// Monochrome, print-ready invoice document styled after a classic studio invoice:
// dark sidebar (QR + dates + billed-to), big INVOICE heading, reference box,
// dark-header item table, totals, and a contact footer.
export function InvoiceReceipt({
  invoiceNumber,
  referenceNumber,
  date,
  dueDate,
  billedToName,
  billedToEmail,
  billedToPhone,
  qrCodeBase64,
  transactionId,
  currency,
  items,
  isVerified,
}: InvoiceReceiptProps) {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const vat = 0;
  const total = subtotal + vat;
  const cur = currency.toUpperCase();

  return (
    <div className="bg-white text-neutral-900 shadow-2xl print:shadow-none w-full max-w-3xl mx-auto">
      <div className="p-5 sm:p-8 md:p-12">
        {/* ===== Top: dark sidebar + title block ===== */}
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Left dark panel */}
          <div className="sm:w-64 flex-shrink-0">
            {/* QR floating above the panel */}
            <div className="flex sm:block justify-center">
              <div className="bg-white border border-neutral-200 p-3 inline-block relative z-10 sm:ml-8 shadow-sm">
                {qrCodeBase64 ? (
                  <Image
                    src={qrCodeBase64}
                    alt="Verification QR code"
                    width={110}
                    height={110}
                    className="w-[110px] h-[110px]"
                  />
                ) : (
                  <div className="w-[110px] h-[110px] bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400 text-center px-2">
                    QR not available
                  </div>
                )}
              </div>
            </div>

            <div className="bg-neutral-900 text-white px-8 pt-16 pb-10 -mt-12 space-y-6">
              <div>
                <p className="text-xs font-bold tracking-wide">Date :</p>
                <p className="text-sm text-neutral-300 mt-1">{fmtDate(date)}</p>
              </div>
              {dueDate && (
                <div>
                  <p className="text-xs font-bold tracking-wide">Due Date :</p>
                  <p className="text-sm text-neutral-300 mt-1">{fmtDate(dueDate)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-bold tracking-wide">To</p>
                <p className="text-sm text-neutral-100 mt-1 font-medium">{billedToName}</p>
                {billedToPhone && <p className="text-sm text-neutral-300 mt-3">{billedToPhone}</p>}
                {billedToEmail && (
                  <p className="text-sm text-neutral-300 break-all">{billedToEmail}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right title block */}
          <div className="flex-1 pt-2">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <span className="w-3.5 h-3.5 rounded-full border-[3px] border-white block" />
              </span>
              <div>
                <p className="font-bold text-neutral-900 leading-tight">Cielo Vista Apartments</p>
                <p className="text-xs text-neutral-500">Premium Residences — Kigali, Rwanda</p>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mt-6 sm:mt-8 text-neutral-900">
              INVOICE
            </h1>
            <p className="text-sm text-neutral-400 mt-1">Document Payment Information</p>

            {/* Reference / invoice number box */}
            <div className="bg-neutral-100 mt-6 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0">
              <div className="flex-1 text-center">
                <p className="text-xs text-neutral-500">Reference No:</p>
                <p className="text-sm font-semibold text-neutral-900 mt-0.5 break-all">
                  {referenceNumber}
                </p>
              </div>
              <div className="hidden sm:block w-px self-stretch bg-neutral-300 mx-4" />
              <div className="sm:hidden h-px w-full bg-neutral-300" />
              <div className="flex-1 text-center">
                <p className="text-xs text-neutral-500">Invoice No:</p>
                <p className="text-sm font-semibold text-neutral-900 mt-0.5">#{invoiceNumber}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-6 items-start">
              <div>
                <p className="text-sm font-bold text-neutral-900">
                  Payment
                  <br />
                  Method
                </p>
                <span className="block w-8 h-0.5 bg-neutral-900 mt-2" />
              </div>
              <div className="text-sm text-neutral-500 space-y-1 pt-0.5">
                <p>Card payment via Stripe</p>
                {transactionId && <p className="break-all font-mono text-xs">{transactionId}</p>}
                {isVerified && (
                  <p className="flex items-center gap-1.5 text-neutral-700 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Verified receipt
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Items table ===== */}
        <div className="mt-8 sm:mt-10">
          {/* Rate column is hidden on small phones so the row never overflows */}
          <div className="bg-neutral-900 text-white grid grid-cols-12 px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-semibold">
            <p className="col-span-7 sm:col-span-6">Item Description</p>
            <p className="hidden sm:block col-span-2 text-right">Rate</p>
            <p className="col-span-2 text-right">Unit</p>
            <p className="col-span-3 sm:col-span-2 text-right">Subtotal</p>
          </div>
          <div className="border-x border-b border-neutral-100">
            {items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm border-b border-neutral-100 last:border-b-0"
              >
                <p className="col-span-7 sm:col-span-6 font-medium text-neutral-900 break-words pr-2">
                  {item.description}
                </p>
                <p className="hidden sm:block col-span-2 text-right text-neutral-600">
                  {fmtMoney(item.rate)}
                </p>
                <p className="col-span-2 text-right text-neutral-600">{item.unit}</p>
                <p className="col-span-3 sm:col-span-2 text-right font-semibold text-neutral-900">
                  {fmtMoney(item.subtotal)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-between items-start pt-6 px-4 sm:px-6">
            <div className="text-sm space-y-3">
              <p className="font-bold text-neutral-900">
                Subtotal <span className="font-normal text-neutral-400 ml-4">:</span>
              </p>
              <p className="font-bold text-neutral-900">
                Tax / VAT (0%) <span className="font-normal text-neutral-400 ml-4">:</span>
              </p>
              <p className="font-extrabold text-neutral-900 text-base">
                Total <span className="font-normal text-neutral-400 ml-4">:</span>
              </p>
            </div>
            <div className="text-sm text-right space-y-3">
              <p className="font-semibold text-neutral-900">
                {cur} {fmtMoney(subtotal)}
              </p>
              <p className="font-semibold text-neutral-900">
                {cur} {fmtMoney(vat)}
              </p>
              <p className="font-extrabold text-neutral-900 text-base">
                {cur} {fmtMoney(total)}
              </p>
            </div>
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div className="mt-12 pt-8 border-t border-neutral-200 flex flex-col sm:flex-row justify-between gap-6">
          <p className="text-xs text-neutral-400 leading-relaxed max-w-xs">
            This receipt was generated automatically after a successful payment and does not
            require a signature. Scan the QR code to verify its authenticity.
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <Mail className="h-3 w-3 text-white" />
              </span>
              <span className="text-neutral-700">support@cielovista.rw</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3 w-3 text-white" />
              </span>
              <span className="text-neutral-700">Kigali, Rwanda</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
