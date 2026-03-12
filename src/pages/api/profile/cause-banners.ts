// src/pages/api/profile/cause-banners.ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);
const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, data: d }), { headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

// GET — fetch current state
export const GET: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;

  const { data } = await sb
    .from('profiles')
    .select('cause_banners, custom_causes')
    .eq('id', profile.id)
    .single();

  return ok({
    cause_banners:  data?.cause_banners  ?? [],
    custom_causes:  data?.custom_causes  ?? [],
  });
};

// POST — toggle standard cause OR add custom cause
export const POST: APIRoute = async (ctx) => {
  if (!ctx.request.headers.get('content-type')?.includes('application/json'))
    return err('Invalid content-type', 415);

  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  // Fetch current state
  const { data: current } = await sb
    .from('profiles')
    .select('cause_banners, custom_causes')
    .eq('id', profile.id)
    .single();

  const currentBanners: string[]  = current?.cause_banners  ?? [];
  const currentCustom:  any[]     = current?.custom_causes  ?? [];

  // ── Standard toggle ─────────────────────────────────────────
  if (!body.custom) {
    const { slug, enabled } = body;
    if (!slug || typeof slug !== 'string') return err('slug requis', 400);

    const newBanners = enabled
      ? [...new Set([...currentBanners, slug])]          // add
      : currentBanners.filter((s: string) => s !== slug); // remove

    const { error } = await sb
      .from('profiles')
      .update({ cause_banners: newBanners })
      .eq('id', profile.id);

    if (error) return err(error.message, 500);
    return ok({ cause_banners: newBanners, custom_causes: currentCustom });
  }

  // ── Custom cause ─────────────────────────────────────────────
  const { label, link, color, enabled } = body;
  if (!label?.trim()) return err('label requis', 400);

  // Max 3 custom causes
  if (currentCustom.length >= 3 && enabled !== false)
    return err('Maximum 3 causes personnalisées', 400);

  const newCustom = enabled === false
    ? currentCustom.filter((c: any) => c.label !== label)
    : [...currentCustom, {
        label:  label.trim().slice(0, 40),
        link:   link?.trim() || null,
        color:  color || '#ffffff',
        icon:   '🎗️',
      }];

  const { error } = await sb
    .from('profiles')
    .update({ custom_causes: newCustom })
    .eq('id', profile.id);

  if (error) return err(error.message, 500);
  return ok({ cause_banners: currentBanners, custom_causes: newCustom });
};

// DELETE — remove specific cause
export const DELETE: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;

  const url   = new URL(ctx.request.url);
  const slug  = url.searchParams.get('slug');
  if (!slug) return err('slug requis', 400);

  const { data: current } = await sb
    .from('profiles')
    .select('cause_banners')
    .eq('id', profile.id)
    .single();

  const newBanners = (current?.cause_banners ?? []).filter((s: string) => s !== slug);

  await sb.from('profiles').update({ cause_banners: newBanners }).eq('id', profile.id);
  return ok({ cause_banners: newBanners });
};