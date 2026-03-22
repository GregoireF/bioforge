// src/lib/modules/profile/theme.ts
// Sanitize et construction du thème — partagé entre profile/index.ts et onboarding.ts
import { PRESET_THEMES } from '@/lib/shared/constants'
import type { PresetTheme } from '@/lib/shared/constants'

// ─── Allowlists ───────────────────────────────────────────────────────────────

export const ALLOWED_FONTS = new Set([
  'Exo 2','Orbitron','Rajdhani','Bebas Neue','Audiowide','Russo One',
  'Space Grotesk','DM Sans','Quicksand','Figtree','Outfit','Plus Jakarta Sans',
  'Nunito','Poppins','Josefin Sans','Archivo','Barlow','Rubik','Work Sans',
  'Manrope','Space Mono','JetBrains Mono','Fira Code','Playfair Display',
  'Lora','Merriweather','DM Serif Display','Bungee','Righteous','Teko',
  'Oswald','Anton','Syne','Cabinet Grotesk','Inter','Roboto','Montserrat',
  'Open Sans','Lato','Geist','Afacad',
])

// ─── Helpers internes ─────────────────────────────────────────────────────────

export function sanitizeHex(v: unknown, fb: string): string {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fb
}

function clamp(v: unknown, min: number, max: number, fb: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fb
}

function pick<T extends string>(v: unknown, opts: readonly T[], fb: T): T {
  return typeof v === 'string' && opts.includes(v as T) ? (v as T) : fb
}

function sanitizeUrl(v: unknown, max = 500): string {
  if (typeof v !== 'string') return ''
  const s = v.trim().slice(0, max)
  return s === '' || s.startsWith('https://') ? s : ''
}

// ─── sanitizeTheme ────────────────────────────────────────────────────────────

export function sanitizeTheme(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    background_color:    sanitizeHex(raw.background_color,  '#0a0a0a'),
    primary_color:       sanitizeHex(raw.primary_color,     '#00ff9d'),
    text_color:          sanitizeHex(raw.text_color,        '#ffffff'),
    gradient_color_2:    sanitizeHex(raw.gradient_color_2,  '#1a1a2e'),
    overlay_color:       sanitizeHex(raw.overlay_color,     '#000000'),
    font_family:         ALLOWED_FONTS.has(raw.font_family as string) ? raw.font_family : 'Exo 2',
    border_radius:       clamp(raw.border_radius,   0, 40,  14),
    gradient_angle:      clamp(raw.gradient_angle,  0, 360, 135),
    pattern_opacity:     clamp(raw.pattern_opacity, 5, 60,  15),
    glass_intensity:     clamp(raw.glass_intensity, 4, 32,  12),
    hero_overlay:        clamp(raw.hero_overlay,    0, 90,  40),
    shadow_intensity:    clamp(raw.shadow_intensity,0, 5,   3),
    hover_scale:         clamp(raw.hover_scale,     0, 5,   3),
    wallpaper_blur:      clamp(raw.wallpaper_blur,  0, 20,  0),
    wallpaper_dim:       clamp(raw.wallpaper_dim,   0, 90,  50),
    background_style:    pick(raw.background_style,  ['solid','gradient','blur'] as const, 'solid'),
    gradient_type:       pick(raw.gradient_type,     ['linear','radial'] as const, 'linear'),
    button_style:        pick(raw.button_style,      ['filled','outline','glass','gradient','neon','minimal','shadow'] as const, 'filled'),
    pattern:             pick(raw.pattern,           ['none','dots','grid','waves','noise','mesh','crosshatch','triangles'] as const, 'none'),
    avatar_shape:        pick(raw.avatar_shape,      ['circle','square','hex','ring'] as const, 'circle'),
    avatar_size:         pick(raw.avatar_size,       ['sm','md','lg'] as const, 'md'),
    avatar_border:       pick(raw.avatar_border,     ['none','solid','glow','gradient','double'] as const, 'glow'),
    spacing:             pick(raw.spacing,           ['compact','normal','spacious'] as const, 'normal'),
    animation_preset:    pick(raw.animation_preset,  ['none','fade','slide','bounce','stagger'] as const, 'fade'),
    profile_layout:      pick(raw.profile_layout,    ['centered','left','card','minimal'] as const, 'centered'),
    content_width:       pick(raw.content_width,     ['narrow','normal','wide'] as const, 'normal'),
    header_style:        pick(raw.header_style,      ['simple','glass','banner','hero'] as const, 'simple'),
    hero_height:         pick(raw.hero_height,       ['sm','md','lg','full'] as const, 'md'),
    hero_position:       pick(raw.hero_position,     ['top','center','bottom'] as const, 'center'),
    hero_style:          pick(raw.hero_style,        ['cinematic','centered','minimal'] as const, 'cinematic'),
    social_icon_style:   pick(raw.social_icon_style, ['round','square','pill','ghost','colored'] as const, 'round'),
    hover_effect:        pick(raw.hover_effect,      ['none','lift','glow','slide','ripple'] as const, 'lift'),
    button_width:        pick(raw.button_width,      ['full','auto'] as const, 'full'),
    link_separator:      pick(raw.link_separator,    ['none','line','dots','gradient','glow'] as const, 'none'),
    link_icon_pos:       pick(raw.link_icon_pos,     ['left','right','none'] as const, 'left'),
    wallpaper_type:      pick(raw.wallpaper_type,    ['none','image','video'] as const, 'none'),
    logo_size:           pick(raw.logo_size,         ['sm','md','lg'] as const, 'md'),
    bio_size:            pick(raw.bio_size,          ['xs','sm','md','lg'] as const, 'sm'),
    bio_style:           pick(raw.bio_style,         ['normal','italic'] as const, 'normal'),
    block_shadow:        typeof raw.block_shadow      === 'boolean' ? raw.block_shadow      : true,
    animations:          typeof raw.animations        === 'boolean' ? raw.animations        : true,
    scroll_reveal:       typeof raw.scroll_reveal     === 'boolean' ? raw.scroll_reveal     : true,
    click_ripple:        typeof raw.click_ripple      === 'boolean' ? raw.click_ripple      : false,
    overlay_top:         typeof raw.overlay_top       === 'boolean' ? raw.overlay_top       : false,
    overlay_bottom:      typeof raw.overlay_bottom    === 'boolean' ? raw.overlay_bottom    : false,
    show_logo:           typeof raw.show_logo         === 'boolean' ? raw.show_logo         : false,
    link_hover_fill:     typeof raw.link_hover_fill   === 'boolean' ? raw.link_hover_fill   : false,
    show_username:       typeof raw.show_username     === 'boolean' ? raw.show_username     : true,
    hero_image:          sanitizeUrl(raw.hero_image),
    logo_url:            sanitizeUrl(raw.logo_url),
    wallpaper_url:       sanitizeUrl(raw.wallpaper_url),
    wallpaper_video_url: sanitizeUrl(raw.wallpaper_video_url),
    custom_font_url:     sanitizeUrl(raw.custom_font_url),
    custom_font_name:    typeof raw.custom_font_name === 'string' ? raw.custom_font_name.trim().slice(0, 60)  : '',
    custom_css:          typeof raw.custom_css       === 'string' ? raw.custom_css.slice(0, 4000)             : '',
    preset:              typeof raw.preset           === 'string' ? raw.preset.trim().slice(0, 30)            : 'dark',
  }
}

// ─── buildPresetTheme ─────────────────────────────────────────────────────────

const PRESET_CONFIGS: Record<PresetTheme, Record<string, unknown>> = {
  dark:    { preset: 'dark',    background_color: '#0a0a0a', primary_color: '#00ff9d', text_color: '#ffffff', gradient_color_2: '#0f1f15' },
  neon:    { preset: 'neon',    background_color: '#1a0033', primary_color: '#bf00ff', text_color: '#ffffff', gradient_color_2: '#0d001a' },
  ocean:   { preset: 'ocean',   background_color: '#001a33', primary_color: '#00d4ff', text_color: '#ffffff', gradient_color_2: '#002244' },
  light:   { preset: 'light',   background_color: '#f8f8f8', primary_color: '#0066ff', text_color: '#0a0a0a', gradient_color_2: '#e8f0ff' },
}

const THEME_DEFAULTS: Record<string, unknown> = {
  button_style: 'filled', border_radius: 14, font_family: 'Exo 2',
  avatar_shape: 'circle', avatar_border: 'glow', animations: true,
  animation_preset: 'fade', spacing: 'normal', block_shadow: true,
}

export function buildPresetTheme(preset?: string): Record<string, unknown> {
  const base = PRESET_CONFIGS[preset as PresetTheme] ?? PRESET_CONFIGS.dark
  return { ...base, ...THEME_DEFAULTS }
}