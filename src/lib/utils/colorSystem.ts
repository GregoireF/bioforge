// lib/colorSystem.ts
import * as culori from 'culori';

type OklchColor = {
  mode?: string;  // facultatif
  l: number;
  c: number;
  h: number;
};

// ── Seed hashing ──────────────────────────────────────────────
export function hashSeed(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

// ── Seed → random [0,1] ─────────────────────────────────────
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ── Seed → HEX (#rrggbb) ────────────────────────────────────
export function seedToHex(seedString: string) {
  const seed = hashSeed(seedString);
  const rand = seededRandom(seed);
  const r = Math.floor(rand * 256).toString(16).padStart(2,'0');
  const g = Math.floor((rand * 1.7 % 1) * 256).toString(16).padStart(2,'0');
  const b = Math.floor((rand * 2.3 % 1) * 256).toString(16).padStart(2,'0');
  return `#${r}${g}${b}`;
}

// ── Détection automatique dark/light mode ───────────────────
export function detectModeFromHex(hex: string): 'dark' | 'light' {
  const oklch = culori.oklch(culori.parse(hex)!);
  return oklch.l! < 0.5 ? 'dark' : 'light';
}

// ── Adjust OKLCH for WCAG contrast ──────────────────────────
function adjustForContrast(color: OklchColor, bg: string, mode: 'dark'|'light') {
  let c = { ...color };
  let attempts = 0;

  while ((culori.contrast(culori.formatHex(c) || '#ff00ff', bg) < 4.5) && attempts < 20) {
    c.l += mode === 'dark' ? 0.02 : -0.02;
    c.c += 0.01;
    c.l = Math.min(1, Math.max(0, c.l));
    c.c = Math.min(0.3, Math.max(0.02, c.c));
    attempts++;
  }

  return c;
}

// ── Generate triad hues ─────────────────────────────────────
function generateTriadHues(baseHue: number) {
  return [
    baseHue,
    (baseHue + 120) % 360,
    (baseHue + 240) % 360
  ];
}

// ── Generate gradient hue ±30° ──────────────────────────────
function generateGradientHue(baseHue: number, rand: number) {
  return (baseHue + (rand * 60 - 30) + 360) % 360;
}

// ── Palette complète OKLCH + auto dark/light ─────────────────
export function generateFullPalette(seedString: string, mode?: 'dark'|'light') {
  const seedHex = seedToHex(seedString);
  const finalMode = mode || detectModeFromHex(seedHex);

  const seed = hashSeed(seedString);
  const rand = seededRandom(seed);

  const base = culori.oklch(culori.parse(seedHex)!);

  const background = finalMode==='dark'? '#0a0a0a' : '#ffffff';
  const surface = finalMode==='dark'? '#121212' : '#f5f5f5';

  const [primaryHue, secondaryHue, accentHue] = generateTriadHues(base.h!);
  const gradientHue = generateGradientHue(base.h!, rand);

  const baseL = finalMode==='dark'? Math.min(base.l! + 0.15, 0.85) : Math.max(base.l! - 0.15, 0.15);

  const primary = adjustForContrast({l: baseL, c: base.c!, h: primaryHue}, background, finalMode);
  const secondary = adjustForContrast({l: baseL, c: base.c! * 0.9, h: secondaryHue}, background, finalMode);
  const accent = adjustForContrast({l: baseL, c: base.c! * 1.1, h: accentHue}, background, finalMode);
  const gradient = adjustForContrast({l: baseL, c: base.c!, h: gradientHue}, background, finalMode);

  const text = finalMode==='dark'? '#ffffff' : '#111111';

  // Options supplémentaires pour API
  const background_style = rand > 0.5 ? 'gradient' : 'solid';
  const gradient_type = rand > 0.5 ? 'radial' : 'linear';
  const gradient_angle = Math.floor(rand * 360);
  const pattern = ['none','dots','grid','waves','noise','mesh'][Math.floor(rand * 6)];
  const pattern_opacity = Math.min(Math.max(Math.floor(rand * 60), 5), 60);

  return {
    background_color: culori.formatHex(background),
    surface_color: culori.formatHex(surface),
    primary_color: culori.formatHex(primary),
    secondary_color: culori.formatHex(secondary),
    accent_color: culori.formatHex(accent),
    gradient_color: culori.formatHex(gradient),
    text_color: text,
    background_style,
    gradient_type,
    gradient_angle,
    pattern,
    pattern_opacity
  };
}