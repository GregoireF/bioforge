import type { Database } from '@/lib/supabase/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type RawTheme = Profile['theme']

// ────────────────────────────────────────────────
//  THEME TYPES (beaucoup plus strict et utile)
// ────────────────────────────────────────────────

export interface Theme {
  readonly preset: 'light' | 'dark' | 'system' | string
  readonly background_color: string
  readonly primary_color: string
  readonly text_color: string
  readonly secondary_text_color?: string
  readonly accent_color?: string
  readonly button_style: 'filled' | 'outline' | 'ghost' | 'soft'
  readonly border_radius: number
  readonly font_family: string
  readonly [key: string]: unknown // extensibilité future
}

const DEFAULT_THEME: Theme = {
  preset: 'dark',
  background_color: '#0a0a0a',
  primary_color: '#00ff9d',
  text_color: '#ffffff',
  button_style: 'filled',
  border_radius: 12,
  font_family: 'Inter',
} as const

// ────────────────────────────────────────────────
//  VALIDATION
// ────────────────────────────────────────────────

/** Vérifie si un username est valide (3–24 caractères alphanum + underscore) */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(username)
}

/** Vérifie si l'URL est valide et commence par http(s):// */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim() === '') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Validation email RFC 5322 simplifiée mais efficace */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false
  const trimmed = email.trim().toLowerCase()
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
    trimmed
  )
}

// ────────────────────────────────────────────────
//  FORMATTING
// ────────────────────────────────────────────────

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Format compact : 1.2K, 4.8M, 950 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return '—'
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString('en-US')
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '$0.00'
  return `$${(cents / 100).toFixed(2)}`
}

export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

// ────────────────────────────────────────────────
//  PROFILE
// ────────────────────────────────────────────────

export function getAvatarUrl(profile: Profile | null | undefined): string {
  return profile?.avatar_url || '/default-avatar.png'
}

export function getDisplayName(profile: Profile | null | undefined): string {
  return profile?.display_name || profile?.username || 'Anonymous'
}

export function getProfileUrl(profile: Profile | null | undefined): string {
  if (!profile) return '/'
  return profile.custom_domain ? `https://${profile.custom_domain}` : `/${profile.username}`
}

const PLAN_COLORS = {
  Free: 'gray',
  Creator: 'blue',
  Pro: 'purple',
  Enterprise: 'green',
} as const satisfies Record<string, string>

export function getPlanBadgeColor(plan: string | null | undefined): string {
  return plan && plan in PLAN_COLORS ? PLAN_COLORS[plan as keyof typeof PLAN_COLORS] : 'gray'
}

// ────────────────────────────────────────────────
//  THEME
// ────────────────────────────────────────────────

/** Parse et normalise n’importe quelle valeur theme venant de la DB */
export function parseTheme(raw: RawTheme): Theme {
  if (!raw) return { ...DEFAULT_THEME }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return normalizeTheme(parsed)
    } catch {
      return { ...DEFAULT_THEME }
    }
  }

  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return normalizeTheme(raw)
  }

  return { ...DEFAULT_THEME }
}

function normalizeTheme(input: Record<string, unknown>): Theme {
  return {
    preset: getString(input.preset, DEFAULT_THEME.preset),
    background_color: getColor(input.background_color, DEFAULT_THEME.background_color),
    primary_color: getColor(input.primary_color, DEFAULT_THEME.primary_color),
    text_color: getColor(input.text_color, DEFAULT_THEME.text_color),
    secondary_text_color: getString(input.secondary_text_color),
    accent_color: getString(input.accent_color),
    button_style: getButtonStyle(input.button_style),
    border_radius: getNumber(input.border_radius, DEFAULT_THEME.border_radius),
    font_family: getString(input.font_family, DEFAULT_THEME.font_family),
  }
}

function getString(val: unknown, fallback = ''): string {
  return typeof val === 'string' && val.trim() ? val.trim() : fallback
}

function getColor(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback
  const trimmed = val.trim()
  return /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb|^hsl/.test(trimmed) ? trimmed : fallback
}

function getNumber(val: unknown, fallback: number): number {
  const num = Number(val)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

const BUTTON_STYLES = ['filled', 'outline', 'ghost', 'soft'] as const
function getButtonStyle(val: unknown): Theme['button_style'] {
  return typeof val === 'string' && BUTTON_STYLES.includes(val as any)
    ? (val as Theme['button_style'])
    : DEFAULT_THEME.button_style
}

// ────────────────────────────────────────────────
//  BLOCKS
// ────────────────────────────────────────────────

const BLOCK_ICONS = {
  link: '🔗',
  heading: '📝',
  spacer: '—',
  image: '🖼️',
  video: '🎥',
  embed: '📺',
  social: '👥',
  countdown: '⏰',
  'live-stream': '🔴',
  tiktok_series: '📱',
  tiktok_gift: '🎁',
  tiktok_shop: '🛒',
  twitch_clip: '🎮',
  twitch_vod: '📽️',
} as const

export function getBlockIcon(type: string): string {
  return BLOCK_ICONS[type as keyof typeof BLOCK_ICONS] ?? '📌'
}

const BLOCK_NAMES = {
  link: 'Link',
  heading: 'Heading',
  spacer: 'Spacer',
  image: 'Image',
  video: 'Video',
  embed: 'Embed',
  social: 'Social',
  countdown: 'Countdown',
  'live-stream': 'Live Stream',
  tiktok_series: 'TikTok Series',
  tiktok_gift: 'TikTok Gift',
  tiktok_shop: 'TikTok Shop',
  twitch_clip: 'Twitch Clip',
  twitch_vod: 'Twitch VOD',
} as const

export function getBlockTypeName(type: string): string {
  return BLOCK_NAMES[type as keyof typeof BLOCK_NAMES] ?? 'Block'
}

export const PREMIUM_BLOCK_TYPES = new Set<string>([
  'tiktok_series',
  'tiktok_gift',
  'tiktok_shop',
  'live-stream',
  'twitch_clip',
  'twitch_vod',
  'countdown',
  'embed',
])

export function isPremiumBlockType(type: string): boolean {
  return PREMIUM_BLOCK_TYPES.has(type)
}

// ────────────────────────────────────────────────
//  URL / FAVICON
// ────────────────────────────────────────────────

export function getUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getFaviconUrl(url: string, size: 16 | 32 | 64 = 32): string {
  const domain = getUrlDomain(url)
  if (!domain || domain.includes('localhost')) return '/favicon.ico'
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}

// ────────────────────────────────────────────────
//  TIME
// ────────────────────────────────────────────────

export function getTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return 'never'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 0) return 'in future'
  if (seconds < 45) return 'just now'
  if (seconds < 90) return '1m ago'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 7200) return '1h ago'
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 172800) return 'yesterday'
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 1_209_600) return '1w ago'
  if (seconds < 2_592_000) return `${Math.floor(seconds / 604_800)}w ago`
  if (seconds < 31_536_000) return `${Math.floor(seconds / 2_592_000)}mo ago`
  return `${Math.floor(seconds / 31_536_000)}y ago`
}

// ────────────────────────────────────────────────
//  Analytics / Growth
// ────────────────────────────────────────────────

export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : current < 0 ? -100 : 0
  return ((current - previous) / previous) * 100
}

export function getGrowthLabel(growth: number, withSign = true): string {
  if (!Number.isFinite(growth)) return '—'
  const rounded = growth.toFixed(1)
  if (withSign) return growth > 0 ? `+${rounded}%` : `${rounded}%`
  return `${Math.abs(Number(rounded))}%`
}

export function getGrowthColor(growth: number): 'green' | 'red' | 'gray' {
  return growth > 0 ? 'green' : growth < 0 ? 'red' : 'gray'
}

// ────────────────────────────────────────────────
//  UTILS
// ────────────────────────────────────────────────

export function generateSlug(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function generateUsername(email: string): string {
  if (!email || !email.includes('@')) return `user_${Math.random().toString(36).slice(2, 8)}`
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}_${suffix}`.slice(0, 24)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as any).message)
  }
  return 'An unexpected error occurred'
}