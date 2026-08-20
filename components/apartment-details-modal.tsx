"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, X, Play, Bed, Bath, Square } from "lucide-react";

export interface ApartmentForDetails {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  price_per_month?: number | null;
  price_per_day?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  size_sqm?: number | null;
  location?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
}

// Ordered photo list, cover (image_url) first, de-duped.
export function galleryOf(apt: ApartmentForDetails): string[] {
  const list = Array.isArray(apt.image_urls) ? apt.image_urls.filter(Boolean) : [];
  const all = apt.image_url ? [apt.image_url, ...list] : list;
  return Array.from(new Set(all));
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export function ApartmentDetailsModal({
  apt,
  onClose,
  onBook,
}: {
  apt: ApartmentForDetails;
  onClose: () => void;
  /** If provided, "Book Now" calls this instead of linking to the public guest booking page. */
  onBook?: (apt: ApartmentForDetails) => void;
}) {
  const gallery = galleryOf(apt);
  const [active, setActive] = useState<{ url: string; isVideo: boolean } | null>(
    gallery[0] ? { url: gallery[0], isVideo: false } : apt.video_url ? { url: apt.video_url, isVideo: true } : null,
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full bg-white/90 dark:bg-slate-800/90 p-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Main media */}
        <div className="relative h-64 w-full overflow-hidden rounded-t-2xl bg-black">
          {active?.isVideo ? (
            <video src={active.url} controls autoPlay className="h-full w-full object-contain bg-black" />
          ) : active?.url ? (
            <img src={active.url} alt={apt.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800">
              <Building2 className="h-14 w-14 text-slate-300 dark:text-slate-600" />
            </div>
          )}
        </div>

        {/* Thumbnails: photos + tour video */}
        {(gallery.length > 0 || apt.video_url) && (
          <div className="flex gap-2 overflow-x-auto px-4 pt-4">
            {gallery.map((url) => (
              <button
                key={url}
                onClick={() => setActive({ url, isVideo: false })}
                className={`relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                  active?.url === url && !active?.isVideo
                    ? "border-blue-600 dark:border-amber-500"
                    : "border-transparent"
                }`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            {apt.video_url && (
              <button
                onClick={() => setActive({ url: apt.video_url!, isVideo: true })}
                className={`relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900 ${
                  active?.isVideo ? "border-blue-600 dark:border-amber-500" : "border-transparent"
                }`}
                title="Play tour video"
              >
                <video src={apt.video_url} className="h-full w-full object-cover opacity-70" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-6 w-6 text-white drop-shadow" />
                </span>
              </button>
            )}
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mb-1">
            <MapPin className="h-4 w-4" /> {apt.location || apt.type || "Kigali, Rwanda"}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{apt.name}</h2>

          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5">
            {apt.description || "A comfortable, well-designed living space ready for you to call home."}
          </p>

          {/* Quick specs */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="flex flex-col items-center rounded-xl bg-slate-50 dark:bg-slate-800 py-3">
              <Bed className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {apt.bedrooms ?? 0} Bed
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-slate-50 dark:bg-slate-800 py-3">
              <Bath className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {apt.bathrooms ?? 0} Bath
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-slate-50 dark:bg-slate-800 py-3">
              <Square className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {apt.size_sqm ?? 0} sqm
              </span>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <DetailItem
              label="Price / Month"
              value={`RWF ${Number(apt.price_per_month || 0).toLocaleString()}`}
            />
            {apt.price_per_day != null && apt.price_per_day > 0 && (
              <DetailItem
                label="Price / Day"
                value={`RWF ${Number(apt.price_per_day || 0).toLocaleString()}`}
              />
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            {onBook ? (
              <Button
                onClick={() => onBook(apt)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white"
              >
                Book Now
              </Button>
            ) : (
              <Link href={`/booking?apartment=${apt.id}`} className="flex-1">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white">
                  Book Now
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Button + modal in one. Drop this anywhere a client should be able to view an apartment's tour.
export function ViewDetailsButton({
  apt,
  className,
  label = "View Details",
}: {
  apt: ApartmentForDetails;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={
          className ||
          "w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-blue-600 dark:hover:bg-amber-500 hover:text-white transition-colors"
        }
      >
        {label}
      </Button>
      {open && <ApartmentDetailsModal apt={apt} onClose={() => setOpen(false)} />}
    </>
  );
}
