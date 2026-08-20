import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page-level loading states.
 *
 * These replaced full-screen spinners. A spinner tells you the app is busy but
 * nothing about what is coming, so the page lurches into place when data lands.
 * A skeleton that mirrors the real layout means the eye is already in the right
 * position, and nothing moves on arrival — which is the entire point.
 *
 * Each block below is sized to match the component it stands in for. If you
 * change a layout, change its skeleton too; a skeleton that no longer matches
 * is worse than none, because it promises the wrong shape.
 */

/** Screen-reader announcement shared by every skeleton below. */
function LoadingAnnounce({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {label}
    </span>
  );
}

/** A row of summary statistic cards (dashboards). */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A list of records: avatar/……/status, repeated. */
export function ListSkeleton({
  rows = 5,
  withAvatar = false,
}: {
  rows?: number;
  withAvatar?: boolean;
}) {
  return (
    <div className="divide-y rounded-lg border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          {withAvatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** A data table: header rule, then rows of cells. */
export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex gap-4 border-b bg-muted/40 p-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b p-4 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-4 flex-1"
              // Varied widths so it reads as content rather than a grid of bars.
              style={{ maxWidth: c === 0 ? "100%" : `${60 + ((r + c) % 4) * 10}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Property/unit cards with a 4:3 image well. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border bg-card">
          {/* Holds the exact aspect ratio, so the photo landing shifts nothing. */}
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="p-4">
            <Skeleton className="h-5 w-2/3" />
            <div className="mt-3 flex gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A document-shaped surface: receipt, invoice, confirmation. */
export function DocumentSkeleton() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-lg border bg-card">
      <div className="border-b p-6 text-center">
        <Skeleton className="mx-auto h-11 w-11 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-6 w-48" />
        <Skeleton className="mx-auto mt-2 h-3 w-56" />
      </div>
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>
      <div className="border-t p-6 text-center">
        {/* The QR block, at its real size. */}
        <Skeleton className="mx-auto h-[150px] w-[150px]" />
      </div>
    </div>
  );
}

/** Whole-page shell: title, then whatever the page's body is. */
export function PageSkeleton({
  label = "Loading",
  children,
}: {
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <LoadingAnnounce label={`${label}. Please wait.`} />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** The tenant dashboard: balance banner, quick actions, then lists. */
export function DashboardSkeleton() {
  return (
    <PageSkeleton label="Loading your dashboard">
      <StatsSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <ListSkeleton rows={4} />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <ListSkeleton rows={4} />
        </div>
      </div>
    </PageSkeleton>
  );
}
