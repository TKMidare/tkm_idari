const DAY_MS = 86_400_000

/** Bitiş tarihine bu kadar gün kala uyarı gösterilir. */
export const EXPIRY_WARNING_DAYS = 30

function localMidnightUtc(offsetDays = 0): number {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
}

/** Bugünden `offsetDays` gün sonrasının YYYY-AA-GG karşılığı. */
export function isoDateFromToday(offsetDays: number): string {
  return new Date(localMidnightUtc(offsetDays)).toISOString().slice(0, 10)
}

export function daysUntil(isoDate: string): number {
  return Math.round((Date.parse(isoDate) - localMidnightUtc()) / DAY_MS)
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}.${month}.${year}`
}

export function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
}

/** GG.AA.YYYY, GG/AA/YYYY, YYYY-AA-GG metinlerini veya Date nesnesini YYYY-AA-GG yapar. */
export function toIsoDate(raw: unknown): string | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10)
  }
  const text = String(raw).trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text)
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local
      ? [Number(local[3]), Number(local[2]), Number(local[1])]
      : [0, 0, 0]

  const date = new Date(Date.UTC(year, month - 1, day))
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return real && year >= 1900 && year <= 2100 ? date.toISOString().slice(0, 10) : null
}
