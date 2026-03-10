// src/pages/api/profile/og/[username].png.ts
//
// Génère automatiquement une image OG 1200×630 par profil BioForge
//
// Dépendances :
//   npm install satori @resvg/resvg-js
//
// Usage : https://bioforge.click/api/profile/og/{username}.png

import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client (service role) ──────────────────────────────────────────
function getSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars missing');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeHex(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val) ? val : fallback;
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.55;
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Fonts (Inter – cached globally) ─────────────────────────────────────────
let interRegular: ArrayBuffer | null = null;
let interBold: ArrayBuffer | null = null;

async function loadFonts() {
  if (interRegular && interBold) return;

  const [reg, bold] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZJhiI2B.woff')
      .then(r => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZJhiI2B.woff')
      .then(r => r.arrayBuffer()),
  ]);

  interRegular = reg;
  interBold = bold;
}

// ── Avatar → base64 ─────────────────────────────────────────────────────────
async function fetchAvatarBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const ct = response.headers.get('content-type') ?? 'image/jpeg';
    const buf = await response.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

// ── Route principale ────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ params }) => {
  const { username } = params;

  if (!username || !/^[a-zA-Z0-9_.-]{1,32}$/.test(username)) {
    return new Response('Invalid username', { status: 400 });
  }

  try {
    // 1. Récupération profil
    const supabase = getSupabase();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, display_name, bio, avatar_url, theme, is_verified')
      .eq('username', username.toLowerCase())
      .single();

    if (error || !profile) {
      return ogFallback(username);
    }

    // 2. Parsing thème
    let bgColor = '#0a0a0a';
    let primary = '#00ff9d';
    let textColor = '#ffffff';
    let bgStyle: 'solid' | 'gradient' = 'solid';
    let grad2 = '#0f2a1a';
    let gradAngle = 135;

    try {
      const raw = typeof profile.theme === 'string'
        ? JSON.parse(profile.theme)
        : profile.theme ?? {};
      bgColor = sanitizeHex(raw.background_color, bgColor);
      primary = sanitizeHex(raw.primary_color, primary);
      textColor = sanitizeHex(raw.text_color, textColor);
      grad2 = sanitizeHex(raw.gradient_color_2, grad2);
      bgStyle = ['solid', 'gradient'].includes(raw.background_style) ? raw.background_style : 'solid';
      gradAngle = parseInt(raw.gradient_angle, 10) || 135;
    } catch {
      // defaults déjà définis
    }

    // 3. Chargement assets en parallèle
    const avatarPromise = profile.avatar_url ? fetchAvatarBase64(profile.avatar_url) : Promise.resolve(null);
    await Promise.all([loadFonts(), avatarPromise]);
    const avatarB64 = await avatarPromise;

    // Sécurité fonts
    if (!interRegular || !interBold) {
      throw new Error('Fonts failed to load');
    }

    // 4. Valeurs calculées
    const name = truncate(profile.display_name || `@${profile.username}`, 28);
    const handle = `@${profile.username}`;
    const bio = truncate(profile.bio || '', 90);
    const onPrimary = isDark(primary) ? '#ffffff' : '#0a0a0a';
    const isVerified = Boolean(profile.is_verified);

    const accentGlow = withAlpha(primary, 0.08);
    const accentBorder = withAlpha(primary, 0.15);

    const initials = (profile.display_name || profile.username || '?')
      .charAt(0)
      .toUpperCase();

    // 5. Arbre Satori
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: '1200px',
            height: '630px',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif',
            background: bgStyle === 'gradient'
              ? `linear-gradient(${gradAngle}deg, ${bgColor}, ${grad2})`
              : bgColor,
          },
          children: [

            // Glow haut-gauche
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: '-120px',
                  left: '-80px',
                  width: '500px',
                  height: '500px',
                  borderRadius: '50%',
                  background: withAlpha(primary, 0.12),
                  filter: 'blur(80px)',
                },
              },
            },

            // Glow bas-droite
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  bottom: '-100px',
                  right: '80px',
                  width: '360px',
                  height: '360px',
                  borderRadius: '50%',
                  background: withAlpha(primary, 0.07),
                  filter: 'blur(60px)',
                },
              },
            },

            // Barre latérale gauche
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  bottom: '0',
                  width: '6px',
                  background: `linear-gradient(180deg, ${primary}, ${withAlpha(primary, 0.3)})`,
                },
              },
            },

            // Contenu principal
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: '100%',
                  height: '100%',
                  padding: '64px 72px 64px 80px',
                  gap: '64px',
                },
                children: [

                  // ── LEFT: Profile info ────────────────────────────────────
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        flex: '1',
                        gap: '0px',
                      },
                      children: [

                        // Name row (name + verified badge)
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '16px',
                              marginBottom: '10px',
                            },
                            children: [
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    fontSize: bio ? '52px' : '62px',
                                    fontWeight: '700',
                                    color: textColor,
                                    lineHeight: '1.1',
                                    letterSpacing: '-1px',
                                  },
                                  children: name,
                                },
                              },
                              ...(isVerified ? [{
                                type: 'div',
                                props: {
                                  style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: primary,
                                    flexShrink: '0',
                                    marginTop: '4px',
                                  },
                                  children: {
                                    type: 'svg',
                                    props: {
                                      width: '20', height: '20', viewBox: '0 0 24 24',
                                      fill: 'none', stroke: onPrimary,
                                      strokeWidth: '3', strokeLinecap: 'round', strokeLinejoin: 'round',
                                      children: {
                                        type: 'path',
                                        props: { d: 'M5 13l4 4L19 7' },
                                      },
                                    },
                                  },
                                },
                              }] : []),
                            ],
                          },
                        },

                        // Handle
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '26px',
                              fontWeight: '400',
                              color: primary,
                              marginBottom: bio ? '28px' : '0',
                              letterSpacing: '0.2px',
                            },
                            children: handle,
                          },
                        },

                        // Bio
                        ...(bio ? [{
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '24px',
                              fontWeight: '400',
                              color: withAlpha(textColor, 0.65),
                              lineHeight: '1.55',
                              maxWidth: '560px',
                            },
                            children: bio,
                          },
                        }] : []),

                        // Spacer
                        { type: 'div', props: { style: { flex: '1' } } },

                        // URL pill
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 20px',
                              borderRadius: '100px',
                              background: accentGlow,
                              border: `1px solid ${accentBorder}`,
                              width: 'fit-content',
                            },
                            children: [
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    width: '8px', height: '8px',
                                    borderRadius: '50%',
                                    background: primary,
                                    flexShrink: '0',
                                  },
                                },
                              },
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    fontSize: '20px',
                                    fontWeight: '500',
                                    color: withAlpha(textColor, 0.7),
                                    letterSpacing: '0.3px',
                                  },
                                  children: `bioforge.click/@${profile.username}`,
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },

                  // ── RIGHT: Avatar ─────────────────────────────────────────
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '24px',
                        flexShrink: '0',
                      },
                      children: [
                        // Avatar circle with glow ring
                        {
                          type: 'div',
                          props: {
                            style: {
                              position: 'relative',
                              width: '220px',
                              height: '220px',
                              borderRadius: '50%',
                              background: withAlpha(primary, 0.1),
                              border: `3px solid ${primary}`,
                              boxShadow: `0 0 0 8px ${withAlpha(primary, 0.1)}, 0 0 60px ${withAlpha(primary, 0.25)}`,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                            children: avatarB64
                              ? {
                                  type: 'img',
                                  props: {
                                    src: avatarB64,
                                    width: '220',
                                    height: '220',
                                    style: { objectFit: 'cover', width: '100%', height: '100%' },
                                  },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: {
                                      fontSize: '80px',
                                      fontWeight: '700',
                                      color: primary,
                                      lineHeight: '1',
                                    },
                                    children: initials,
                                  },
                                },
                          },
                        },

                        // BioForge logo wordmark
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            },
                            children: [
                              {
                                type: 'svg',
                                props: {
                                  width: '20', height: '20', viewBox: '0 0 24 24',
                                  fill: 'none', stroke: primary,
                                  strokeWidth: '2.2', strokeLinecap: 'round', strokeLinejoin: 'round',
                                  children: {
                                    type: 'path',
                                    props: { d: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                  },
                                },
                              },
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    color: withAlpha(textColor, 0.45),
                                    letterSpacing: '0.5px',
                                  },
                                  children: 'BioForge',
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
          { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
        ],
      }
    );

    // 6. SVG → PNG
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
      shapeRendering: 2,
      textRendering: 2,
      imageRendering: 0,
    });

    const pngData = resvg.render().asPng(); // Uint8Array

    return new Response(pngData, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        'Content-Length': pngData.byteLength.toString(),
      },
    });
  } catch (err: any) {
    console.error(`[OG / ${username}]`, err?.message || err);
    return ogFallback(username);
  }
};

// ── Fallback simple ─────────────────────────────────────────────────────────
async function ogFallback(username: string): Promise<Response> {
  try {
    await loadFonts();

    if (!interRegular || !interBold) {
      throw new Error('Fonts missing in fallback');
    }

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: '1200px',
            height: '630px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            background: '#0a0a0a',
            fontFamily: 'Inter, sans-serif',
            gap: '20px',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#00ff9d',
                  letterSpacing: '1px',
                },
                children: '⚡ BioForge',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '20px',
                  fontWeight: '400',
                  color: 'rgba(255,255,255,0.4)',
                },
                children: username ? `@${username}` : 'bioforge.click',
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
          { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
        ],
      }
    );

    const resvg = new Resvg(svg);
    const pngData = resvg.render().asPng(); // Uint8Array

    return new Response(pngData, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch {
    // 1×1 transparent PNG en Uint8Array
    const tinyPng = new Uint8Array(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        .split('')
        .map(c => c.charCodeAt(0))
    );

    return new Response(tinyPng, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
    });
  }
}