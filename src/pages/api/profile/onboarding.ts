// src/pages/api/profile/onboarding.ts
// POST — complète l'onboarding: username + display_name + bio + preset thème
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, data: d }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

const PRESET_THEMES: Record<string, object> = {
  dark:    { preset:'dark',    background_color:'#0a0a0a', primary_color:'#00ff9d', text_color:'#ffffff', gradient_color_2:'#0f1f15' },
  neon:    { preset:'neon',    background_color:'#1a0033', primary_color:'#bf00ff', text_color:'#ffffff', gradient_color_2:'#0d001a' },
  ocean:   { preset:'ocean',   background_color:'#001a33', primary_color:'#00d4ff', text_color:'#ffffff', gradient_color_2:'#002244' },
  light:   { preset:'light',   background_color:'#f8f8f8', primary_color:'#0066ff', text_color:'#0a0a0a', gradient_color_2:'#e8f0ff' },
};

export const POST: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return err('Invalid JSON', 400); }

  const { username, display_name, bio, preset, feedback } = body ?? {};

  // ── Validate username ─────────────────────────────────────────────────────
  if (typeof username !== 'string' || !USERNAME_RE.test(username.toLowerCase()))
    return err('Pseudo invalide (3-24 caractères, lettres, chiffres, _)', 400);

  const slug = username.toLowerCase().trim();

  // ── Check uniqueness ──────────────────────────────────────────────────────
  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('username', slug)
    .neq('id', profile.id)
    .maybeSingle();

  if (existing) return err('Ce pseudo est déjà pris', 409);

  // ── Build theme ───────────────────────────────────────────────────────────
  const baseTheme = PRESET_THEMES[preset ?? 'dark'] ?? PRESET_THEMES.dark;
  const theme = {
    ...baseTheme,
    button_style:   'filled',
    border_radius:  14,
    font_family:    'Exo 2',
    avatar_shape:   'circle',
    avatar_border:  'glow',
    animations:     true,
    animation_preset: 'fade',
    spacing:        'normal',
    block_shadow:   true,
  };

  // ── Update profile ────────────────────────────────────────────────────────
  // ── Sanitize feedback ────────────────────────────────────────────────────
  const VALID_USAGES  = ['creator','dev','brand','artist','freelance','other'];
  const VALID_SOURCES = ['social','friend','search','product_hunt','ad','other'];

  const cleanFeedback = feedback && typeof feedback === 'object' ? {
    usages:  Array.isArray(feedback.usages)
      ? feedback.usages.filter((u: string) => VALID_USAGES.includes(u)).slice(0, 6)
      : [],
    source:  VALID_SOURCES.includes(feedback.source) ? feedback.source : null,
    nps:     typeof feedback.nps === 'number' && feedback.nps >= 0 && feedback.nps <= 10
      ? Math.round(feedback.nps) : null,
    comment: typeof feedback.comment === 'string'
      ? feedback.comment.trim().slice(0, 500) || null : null,
  } : null;

  const { data, error } = await sb
    .from('profiles')
    .update({
      username:     slug,
      display_name: typeof display_name === 'string' ? display_name.trim().slice(0, 80) || slug : slug,
      bio:          typeof bio === 'string' ? bio.trim().slice(0, 320) || null : null,
      theme,
      onboarding_feedback:     cleanFeedback,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select('id, username, display_name')
    .single();

  if (error) {
    // Unique constraint violation
    if (error.code === '23505') return err('Ce pseudo est déjà pris', 409);
    return err(error.message, 500);
  }

  return ok(data);
};