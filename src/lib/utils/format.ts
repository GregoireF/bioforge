export function formatNumber(num: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale).format(num)
}

export function formatCompact(num: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(num)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatRelativeTime(date: Date | string, locale = 'fr'): string {
  const d    = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours   = Math.floor(minutes / 60)
  const days    = Math.floor(hours   / 24)
  const months  = Math.floor(days    / 30)
  const years   = Math.floor(days    / 365)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (years   > 0) return rtf.format(-years,   'year')
  if (months  > 0) return rtf.format(-months,  'month')
  if (days    > 0) return rtf.format(-days,    'day')
  if (hours   > 0) return rtf.format(-hours,   'hour')
  if (minutes > 0) return rtf.format(-minutes, 'minute')
  return rtf.format(-seconds, 'second')
}

type DateFormat = 'short' | 'medium' | 'long' | 'full'

const DATE_FORMATS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  short:  { month: 'numeric', day: 'numeric', year: '2-digit'  },
  medium: { month: 'short',   day: 'numeric', year: 'numeric'  },
  long:   { month: 'long',    day: 'numeric', year: 'numeric'  },
  full:   { weekday: 'long',  month: 'long',  day: 'numeric', year: 'numeric' },
}

export function formatDate(date: Date | string, format: DateFormat = 'medium', locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, DATE_FORMATS[format]).format(d)
}

export function formatCurrency(amount: number, currency = 'EUR', locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100)
}

export function truncate(text: string, length: number): string {
  return text.length <= length ? text : text.slice(0, length) + '…'
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}