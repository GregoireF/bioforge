// lib/colorSystem.ts
import * as culori from 'culori';
import type { Oklch } from 'culori';

//
export type ThemeMode = 'dark' | 'light';
export type ThemeStyle = 'default' | 'viral' | 'luxury' | 'minimal';
export type ColorEmotion = 'energetic' | 'calm' | 'luxury' | 'fun';
export type ConversionMode = 'none' | 'cta-boost';

export interface UserProfile {
  niche?: 'gaming' | 'business' | 'creator' | 'music';
  audienceAge?: 'young' | 'adult';
  vibe?: 'energetic' | 'calm';
}

export type Harmony =
  | 'triad'
  | 'analogous'
  | 'complementary'
  | 'split-complementary';

export interface GeneratedPalette {
  background_color: string;
  surface_color: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  gradient_color: string;
  text_color: string;
  background_style: 'solid' | 'gradient';
  gradient_type: 'linear' | 'radial';
  gradient_angle: number;
  pattern: 'none' | 'dots' | 'grid' | 'waves' | 'noise' | 'mesh';
  pattern_opacity: number;
}

export interface ExtendedPalette extends GeneratedPalette {
  border_color: string;
  muted_text_color: string;
  subtle_text_color: string;
  button_hover_color: string;
  card_background: string;
  input_background: string;
  ring_color: string;
  shadow_color: string;
  gradient_css: string;
  theme_signature: string;
}

// ── Memory ──────────────────────────────────────────────────
type MemoryEntry = {
  score: number;
  usage: number;
};

const memory = new Map<string, MemoryEntry>();

function getMemoryBoost(signature: string): number {
  const entry = memory.get(signature);
  if (!entry) return 0;
  return entry.score * 0.3 + entry.usage * 0.1;
}

export function recordPaletteFeedback(signature: string, liked: boolean) {
  const entry = memory.get(signature) ?? { score: 0, usage: 0 };
  entry.usage += 1;
  entry.score += liked ? 2 : -1;
  memory.set(signature, entry);
}

// ── Utils ───────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function createRng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Color Core ──────────────────────────────────────────────
function safeParse(hex: string): Oklch {
  const parsed = culori.oklch(culori.parse(hex) ?? '#ff00ff');
  return parsed ?? { mode: 'oklch', l: 0.7, c: 0.1, h: 200 };
}

export function seedToHex(seedString: string): string {
  const rng = createRng(hashSeed(seedString));
  const r = Math.floor(rng() * 256).toString(16).padStart(2, '0');
  const g = Math.floor(rng() * 256).toString(16).padStart(2, '0');
  const b = Math.floor(rng() * 256).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function detectModeFromHex(hex: string): ThemeMode {
  const oklch = safeParse(hex);
  return (oklch.l ?? 0.5) < 0.5 ? 'dark' : 'light';
}

// ── Style ───────────────────────────────────────────────────
function applyEmotion(color: Oklch, emotion: ColorEmotion): Oklch {
  switch (emotion) {
    case 'energetic':
      return { ...color, c: clamp((color.c ?? 0.1) * 1.8, 0.2, 0.45), l: clamp(color.l ?? 0.6, 0.5, 0.7) };
    case 'calm':
      return { ...color, c: clamp((color.c ?? 0.1) * 0.5, 0.02, 0.08), l: clamp(color.l ?? 0.6, 0.6, 0.85) };
    case 'luxury':
      return { ...color, c: clamp((color.c ?? 0.1) * 0.4, 0.02, 0.1), l: clamp(color.l ?? 0.6, 0.35, 0.6) };
    case 'fun':
      return { ...color, c: clamp((color.c ?? 0.1) * 2.0, 0.25, 0.5), l: clamp(color.l ?? 0.6, 0.55, 0.75) };
    default:
      return color;
  }
}

function stylizeColor(color: Oklch, style: ThemeStyle): Oklch {
  switch (style) {
    case 'viral':
      return { ...color, c: clamp((color.c ?? 0.1) * 2.2, 0.2, 0.45), l: clamp(color.l ?? 0.6, 0.5, 0.75) };
    case 'luxury':
      return { ...color, c: clamp((color.c ?? 0.1) * 0.6, 0.02, 0.12), l: clamp(color.l ?? 0.6, 0.4, 0.7) };
    case 'minimal':
      return { ...color, c: 0.02 };
    default:
      return color;
  }
}

function adjustForContrast(color: Oklch, bg: string, mode: ThemeMode): Oklch {
  let c = { ...color };
  let attempts = 0;

  while ((culori.contrast(culori.formatHex(c) ?? '#ff00ff', bg) ?? 1) < 4.5 && attempts < 24) {
    c.l += mode === 'dark' ? 0.025 : -0.025;
    c.c += 0.01;
    c.l = clamp(c.l ?? 0.5, 0.05, 0.95);
    c.c = clamp(c.c ?? 0.1, 0.02, 0.35);
    attempts++;
  }

  return c;
}

function enforceAccentPriority(primary: Oklch, accent: Oklch) {
  if ((accent.c ?? 0) < (primary.c ?? 0)) {
    return { primary: accent, accent: primary };
  }
  return { primary, accent };
}

// ── Scoring System ──────────────────────────────────────────
function scorePalette(palette: GeneratedPalette, signature: string): number {
  const colors = [palette.primary_color, palette.secondary_color, palette.accent_color, palette.background_color];
  let score = 0;

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const contrast = culori.contrast(colors[i], colors[j]) ?? 0;
      score += contrast * 1.5;
      if (contrast < 3) score -= 8;
      if (contrast > 7) score += 2;
    }
  }

  score += getMemoryBoost(signature);
  return score;
}

// ── Main Generator ──────────────────────────────────────────
function generatePalette(
  seed: string,
  style: ThemeStyle,
  emotion: ColorEmotion,
  conversion: ConversionMode,
  user?: UserProfile
): GeneratedPalette {

  const rng = createRng(hashSeed(seed));
  const seedHex = seedToHex(seed);
  const mode = detectModeFromHex(seedHex);
  const base = safeParse(seedHex);

  const baseHue = base.h ?? 200;
  const h1 = baseHue;
  const h2 = (baseHue + 120) % 360;
  const h3 = (baseHue + 240) % 360;

  const background = mode === 'dark' ? '#0a0a0a' : '#ffffff';
  const surface = mode === 'dark' ? '#121212' : '#f5f5f5';
  const baseL = mode === 'dark'
    ? clamp((base.l ?? 0.6) + 0.15, 0.2, 0.9)
    : clamp((base.l ?? 0.6) - 0.15, 0.1, 0.8);

  let primary = adjustForContrast(stylizeColor(applyEmotion({ ...base, l: baseL, h: h1 }, emotion), style), background, mode);
  let accent = adjustForContrast(stylizeColor(applyEmotion({ ...base, l: baseL, h: h3 }, emotion), style), background, mode);

  ({ primary, accent } = enforceAccentPriority(primary, accent));

  if (conversion === 'cta-boost') {
    accent = {
      ...accent,
      c: clamp((accent.c ?? 0.1) * 2.4, 0.3, 0.5),
      l: clamp(accent.l ?? 0.6, 0.55, 0.7)
    };
  }

  const gradient = adjustForContrast({ ...base, l: baseL, h: h2 }, background, mode);

  return {
    background_color: background,
    surface_color: surface,
    primary_color: culori.formatHex(primary) ?? '#ff00ff',
    secondary_color: culori.formatHex(primary) ?? '#ff00ff',
    accent_color: culori.formatHex(accent) ?? '#ff00ff',
    gradient_color: culori.formatHex(gradient) ?? '#ff00ff',
    text_color: culori.contrast('#fff', background)! > 4.5 ? '#fff' : '#111',
    background_style: rng() > 0.5 ? 'gradient' : 'solid',
    gradient_type: rng() > 0.5 ? 'radial' : 'linear',
    gradient_angle: Math.floor(rng() * 360),
    pattern: 'none',
    pattern_opacity: 20
  };
}


// ── API ───────────────────────────────────────────────
export function generateAdvancedTheme(options: {
  seed: string;
  mode?: ThemeMode;
  style?: ThemeStyle;
  emotion?: ColorEmotion;
  conversion?: ConversionMode;
  user?: UserProfile;
}): ExtendedPalette {

  const { seed, mode, style = 'default', conversion = 'none', user } = options;
  const emotion = options.emotion ?? 'energetic';

  let best: GeneratedPalette | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < 4; i++) {
    const variantSeed = `${seed}-${i}`;
    const palette = generatePalette(variantSeed, style, emotion, conversion, user);
    const signature = `${style}-${palette.primary_color}-${palette.accent_color}`;
    const score = scorePalette(palette, signature);

    if (score > bestScore) {
      best = palette;
      bestScore = score;
    }
  }

  const finalMode = mode ?? detectModeFromHex(seedToHex(seed));

  return {
    ...best!,
    border_color: finalMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    muted_text_color: finalMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    subtle_text_color: finalMode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    button_hover_color: best!.accent_color,
    card_background: finalMode === 'dark' ? '#161616' : '#ffffff',
    input_background: finalMode === 'dark' ? '#1e1e1e' : '#fafafa',
    ring_color: best!.accent_color,
    shadow_color: finalMode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)',
    gradient_css:
      best!.background_style === 'gradient'
        ? `linear-gradient(${best!.gradient_angle}deg, ${best!.primary_color}, ${best!.gradient_color})`
        : best!.background_color,
    theme_signature: `${style}-${seed}`
  };
}