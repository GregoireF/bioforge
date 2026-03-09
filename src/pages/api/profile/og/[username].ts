// src/pages/api/og/[username].ts
import type { APIRoute } from 'astro';
import { rawApiHandler } from '@/lib/api/middleware-raw'; // ← Utilise le wrapper RAW que tu as créé (sans JSON forcé)
import { AppError, ErrorCode } from '@/lib/core/errors';
import { getProfileByUsername, getActiveBlocks } from '@/lib/supabase/queries';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import path from 'node:path';

// ── Config OG ────────────────────────────────────────────────────────────────
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const FONT_PATH = path.resolve(process.cwd(), 'public/fonts/Inter-Regular.woff');

// ── Theme par défaut ────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  background_color: '#0a0a0a',
  primary_color: '#00ff9d',
  text_color: '#ffffff',
  font_family: 'Inter',
};

// ── Sanitizer ───────────────────────────────────────────────────────────────
function sanitizeHex(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val) ? val : fallback;
}

export const GET: APIRoute = rawApiHandler(
  async ({ context, supabase }) => {  // ← context + supabase (optionnel, mais disponible)
    const username = context.params?.username?.trim()?.toLowerCase();

    if (!username || !/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new AppError({
        message: 'Invalid username format',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    }

    // ── Récup profile ───────────────────────────────────────────────────────
    const profileResult = await getProfileByUsername(username);
    if (!profileResult.success || !profileResult.data) {
      throw new AppError({
        message: 'Profile not found',
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
      });
    }
    const profile = profileResult.data;

    // ── Récup blocks (limite à 3) ──────────────────────────────────────────
    const blocksResult = await getActiveBlocks(profile.id);
    const blocks = blocksResult.success ? blocksResult.data.slice(0, 3) : [];

    // ── Theme parsing ───────────────────────────────────────────────────────
    let theme = { ...DEFAULT_THEME };
    if (profile.theme) {
      try {
        const raw = typeof profile.theme === 'string' ? JSON.parse(profile.theme) : profile.theme;
        theme = {
          ...DEFAULT_THEME,
          background_color: sanitizeHex(raw.background_color, DEFAULT_THEME.background_color),
          primary_color: sanitizeHex(raw.primary_color, DEFAULT_THEME.primary_color),
          text_color: sanitizeHex(raw.text_color, DEFAULT_THEME.text_color),
          font_family: raw.font_family && typeof raw.font_family === 'string'
            ? raw.font_family
            : DEFAULT_THEME.font_family,
        };
      } catch {
        // Defaults
      }
    }

    // ── Font ────────────────────────────────────────────────────────────────
    let fontData: Uint8Array;
    try {
      const buffer = await fs.readFile(FONT_PATH);
      fontData = new Uint8Array(buffer);
    } catch (err) {
      console.error('Font loading error:', err);
      throw new AppError({
        message: 'Font file not found',
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    }

    // ── vNode Satori ────────────────────────────────────────────────────────
    const vNode = {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background_color,
          color: theme.text_color,
          fontFamily: theme.font_family,
          padding: '60px 80px',
          boxSizing: 'border-box',
          position: 'relative',
        },
        children: [
          profile.avatar_url
            ? {
                type: 'img',
                props: {
                  src: profile.avatar_url,
                  width: '180',
                  height: '180',
                  style: {
                    borderRadius: '9999px',
                    border: `6px solid ${theme.primary_color}`,
                    marginBottom: '32px',
                    objectFit: 'cover',
                  },
                },
              }
            : {
                type: 'div',
                props: {
                  style: {
                    width: '180px',
                    height: '180px',
                    borderRadius: '9999px',
                    background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.primary_color}cc)`,
                    color: theme.background_color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '90px',
                    fontWeight: 'bold',
                    marginBottom: '32px',
                  },
                  children: (profile.display_name || profile.username || '?').charAt(0).toUpperCase(),
                },
              },

          {
            type: 'h1',
            props: {
              style: {
                fontSize: '64px',
                fontWeight: 'bold',
                margin: '0 0 16px 0',
                textAlign: 'center',
                lineHeight: 1.1,
              },
              children: profile.display_name || `@${profile.username}`,
            },
          },

          profile.bio
            ? {
                type: 'p',
                props: {
                  style: {
                    fontSize: '32px',
                    opacity: 0.85,
                    textAlign: 'center',
                    margin: '0 0 48px 0',
                    maxWidth: '90%',
                  },
                  children: profile.bio.length > 160 ? profile.bio.slice(0, 157) + '...' : profile.bio,
                },
              }
            : null,

          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                gap: '24px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: '100%',
              },
              children: blocks.map((block: any) => ({
                type: 'div',
                props: {
                  style: {
                    backgroundColor: `${theme.primary_color}33`,
                    color: theme.primary_color,
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontSize: '28px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '320px',
                  },
                  children: block.title || block.type.toUpperCase(),
                },
              })),
            },
          },

          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '32px',
                fontSize: '24px',
                opacity: 0.5,
              },
              children: 'bioforge.click',
            },
          },
        ].filter(Boolean),
      },
    };

    // ── SVG + PNG ───────────────────────────────────────────────────────────
    const svg = await satori(vNode, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [{ name: theme.font_family, data: fontData, weight: 400, style: 'normal' }],
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: OG_WIDTH },
      font: { defaultFamily: theme.font_family },
    });
    const png = resvg.render().asPng();

    // ── Response ────────────────────────────────────────────────────────────
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Content-Length': png.byteLength.toString(),
      },
    });
  },
  { requireAuth: false } // Profil public → pas d'auth
);