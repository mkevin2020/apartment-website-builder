import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date consistently across server and client
 * Uses a fixed locale to prevent hydration mismatches
 * Format: "Mar 18, 2026"
 */
export function formatDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    
    // Use fixed locale to prevent hydration errors
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/**
 * Format a date with long month format
 * Format: "March 18, 2026"
 */
export function formatDateLong(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/**
 * Format a number as currency (with locale consideration for SSR safety)
 * Converts numbers to string format without using toLocaleString()
 * Format: "5,000" for 5000
 */
export function formatCurrency(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Keep only digits and an optional single leading "+" (for country codes).
 * Use on phone-number inputs so users can only type numbers.
 */
export function sanitizePhone(value: string): string {
  let s = value.replace(/[^\d+]/g, '') // remove anything that isn't a digit or +
  s = s.replace(/(?!^)\+/g, '') // allow + only as the first character
  return s
}
