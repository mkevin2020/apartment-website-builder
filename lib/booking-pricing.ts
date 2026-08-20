// Shared stay pricing for every booking flow (guest booking page + tenant dashboard).
// Keep this the single source of truth so a guest and a tenant booking the same
// dates on the same apartment always see the same number.

export const DAYS_PER_MONTH = 30

// Daily-stay rule: 4 days or fewer pay the FULL daily price; a stay OVER 4 days
// pays 40% of the full price. Only applies to a pure per-day booking.
export const DAILY_LONG_STAY_THRESHOLD = 4
export const DAILY_LONG_STAY_RATE = 0.4

export type RateType = "daily" | "weekly" | "monthly"

export interface StayBreakdown {
  days: number
  /** Whole 30-day blocks charged at the monthly price */
  months: number
  /** Days left over after the whole months, charged at the daily price */
  extraDays: number
  monthlyPrice: number
  dailyPrice: number
  monthsCost: number
  /** What the leftover days would cost before the monthly cap */
  extraDaysFullCost: number
  /** What the leftover days actually cost (capped at one month) */
  extraDaysCost: number
  /** True when the leftover days were capped down to one month's rent */
  extraDaysCapped: boolean
  /** True when the >4-day 40% rule was applied (pure daily bookings only) */
  longStayDiscount: boolean
  /** Total before any promo code */
  subtotal: number
}

/**
 * Whole days between two yyyy-mm-dd dates, minimum 1.
 * Both ends are pinned to UTC midnight so the count never drifts by a day
 * depending on the server's timezone.
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${String(startDate).slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${String(endDate).slice(0, 10)}T00:00:00Z`)
  const ms = end - start
  if (!Number.isFinite(ms)) return 1
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Price a stay of `days` days.
 *
 * Monthly bookings are split into whole 30-day months plus leftover days:
 *   21 days -> 0 months + 21 days at the daily rate
 *   40 days -> 1 month  + 10 days at the daily rate
 *
 * The leftover days are capped at one month's rent, so a part-month can never
 * cost more than the full month it sits inside.
 */
export function priceStay(
  apt: { price_per_month?: number | null; price_per_day?: number | null } | undefined | null,
  days: number,
  rateType: RateType,
): StayBreakdown {
  const monthlyPrice = Number(apt?.price_per_month) || 0
  const dailyPrice = Number(apt?.price_per_day) || 0
  const safeDays = Math.max(1, Math.floor(days) || 1)

  // Daily and weekly bookings — unchanged from the original rules. Weekly is
  // just 7 daily units and never gets the >4-day discount.
  if (rateType === "daily" || rateType === "weekly") {
    const full = safeDays * dailyPrice
    const longStayDiscount = rateType === "daily" && safeDays > DAILY_LONG_STAY_THRESHOLD
    const subtotal = longStayDiscount ? Math.round(full * DAILY_LONG_STAY_RATE) : full
    return {
      days: safeDays,
      months: 0,
      extraDays: safeDays,
      monthlyPrice,
      dailyPrice,
      monthsCost: 0,
      extraDaysFullCost: full,
      extraDaysCost: subtotal,
      extraDaysCapped: false,
      longStayDiscount,
      subtotal,
    }
  }

  const months = Math.floor(safeDays / DAYS_PER_MONTH)
  const extraDays = safeDays % DAYS_PER_MONTH
  const monthsCost = months * monthlyPrice

  // If the apartment has no daily price set we can't price a part-month by day,
  // so fall back to charging a whole month for the remainder (the old behaviour)
  // rather than letting those days go through free.
  const extraDaysFullCost = extraDays === 0 ? 0 : dailyPrice > 0 ? extraDays * dailyPrice : monthlyPrice

  // A part-month never costs more than the full month it sits inside.
  const extraDaysCost = Math.min(extraDaysFullCost, monthlyPrice || extraDaysFullCost)
  const extraDaysCapped = extraDaysFullCost > extraDaysCost

  return {
    days: safeDays,
    months,
    extraDays,
    monthlyPrice,
    dailyPrice,
    monthsCost,
    extraDaysFullCost,
    extraDaysCost,
    extraDaysCapped,
    longStayDiscount: false,
    subtotal: monthsCost + extraDaysCost,
  }
}

/** Same as priceStay but taking a date range instead of a day count. */
export function priceStayForDates(
  apt: { price_per_month?: number | null; price_per_day?: number | null } | undefined | null,
  startDate: string,
  endDate: string,
  rateType: RateType,
): StayBreakdown {
  return priceStay(apt, daysBetween(startDate, endDate), rateType)
}
