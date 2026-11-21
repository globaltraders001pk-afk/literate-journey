/**
 * Shared date helpers (QA audit M5 / M9 / L8).
 *
 * One definition of "urgent" and one way of counting days, used by
 * the radars, the dashboard and the invoice alike — the strip and
 * the KPI card used to disagree by a day near midnight because each
 * computed days-left its own way (midnight-floor vs ceil-from-now).
 *
 * Timezone: the business runs in Asia/Karachi. Invoice dates are
 * formatted in that zone, and a `YYYY-MM-DD` expiry date is parsed
 * as local calendar components — never as UTC midnight, which is
 * the previous calendar day for 00:00–05:00 PKT sales and off by
 * one in negative-offset timezones.
 */

export const ORG_TIMEZONE = 'Asia/Karachi'

/** "Expiring within 30 days" / urgent: fewer than 30 days left.
 * Expired batches (days left < 0) count as urgent too — they are
 * the most urgent of all. A batch expiring in exactly 30 days is
 * NOT urgent; it sits in the WARNING (30–119 day) band. */
export const URGENT_EXPIRY_DAYS = 30

export function isUrgentExpiry(daysLeft: number): boolean {
  return daysLeft < URGENT_EXPIRY_DAYS
}

function startOfTodayLocal(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * Parse a date value as local calendar components. A bare
 * `YYYY-MM-DD` string means that calendar day — `new Date(str)`
 * would read it as UTC midnight instead.
 */
export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Whole days from the start of today (local) until the given date. */
export function daysUntil(dateStr: string): number {
  const today = startOfTodayLocal()
  const target = parseLocalDate(dateStr)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pktParts(value: string | Date): { day: number; month: number; year: number; hour: number; minute: number } | null {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { day: get('day'), month: get('month'), year: get('year'), hour: get('hour'), minute: get('minute') }
}

/** "DD Month YYYY" in Asia/Karachi, e.g. "29 September 2026". */
export function formatDayMonthYearPKT(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const p = pktParts(value)
  if (!p) return '—'
  return `${String(p.day).padStart(2, '0')} ${MONTHS[p.month - 1]} ${p.year}`
}

/** "DD Month YYYY, HH:MM" in Asia/Karachi. */
export function formatDateTimePKT(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const p = pktParts(value)
  if (!p) return '—'
  return `${formatDayMonthYearPKT(value)}, ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/**
 * Add whole calendar days to a timestamp, counted in the org
 * timezone: the due date is the invoice's PKT calendar date plus
 * N days, not the UTC instant plus N × 24h (which can land on the
 * wrong PKT date for early-morning sales).
 */
export function addDaysPKT(value: string | Date | null | undefined, days: number): Date | null {
  if (!value) return null
  const p = pktParts(value)
  if (!p) return null
  // Noon UTC of the resulting calendar day is safely inside that
  // day in PKT (UTC+5), so formatting it back gives the right date.
  return new Date(Date.UTC(p.year, p.month - 1, p.day + days, 12))
}

/** Today's date as `YYYY-MM-DD` in Asia/Karachi. */
export function todayPKT(): string {
  const p = pktParts(new Date())
  if (!p) return new Date().toISOString().split('T')[0]
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Any date as `YYYY-MM-DD` in Asia/Karachi (for trend buckets). */
export function toPKTDateString(value: string | Date): string {
  const p = pktParts(value)
  if (!p) return new Date(value).toISOString().split('T')[0]
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** "29 Sep 2026" for a `YYYY-MM-DD` expiry date (local components). */
export function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = parseLocalDate(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
