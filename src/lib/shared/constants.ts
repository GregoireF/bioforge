// Onboarding
export const VALID_USAGES = ['creator', 'dev', 'brand', 'artist', 'freelance', 'other'] as const
export const VALID_SOURCES = ['social', 'friend', 'search', 'product_hunt', 'ad', 'other'] as const
export const PRESET_THEMES = ['dark', 'neon', 'ocean', 'light'] as const

export type ValidUsage    = typeof VALID_USAGES[number]
export type ValidSource   = typeof VALID_SOURCES[number]
export type PresetTheme   = typeof PRESET_THEMES[number]

// Short links
export const LINK_CODE_RE = /^[a-z0-9_-]{1,20}$/

// Analytics
export const ANALYTICS_DAYS_STRICT = [7, 30, 90] as const    // dashboard analytics
export const ANALYTICS_DAYS_MAX    = 180                       // stats/index.ts

export type AnalyticsDaysStrict = typeof ANALYTICS_DAYS_STRICT[number]