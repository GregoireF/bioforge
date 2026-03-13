// src/pages/api/profile/seo.ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);
const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, data: d }), { headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async (ctx) => {
  if (!ctx.request.headers.get('content-type')?.includes('application/json'))
    return err('Invalid content-type', 415);

  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile, planLimits } = auth.data;

  // SEO avancé = Creator+
  const _pl    = planLimits as any;
  const plan   = _pl?.plan ?? (profile as any)?.plan ?? 'free';
  const PAID   = ['creator', 'pro', 'enterprise', 'business', 'team'];
  const PROS   = ['pro', 'enterprise', 'business', 'team'];
  if (!PAID.includes(plan)) return err('Plan Creator requis pour le SEO avancé', 403);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const update: any = {};

  if (Array.isArray(body.seo_keywords)) {
    update.seo_keywords = body.seo_keywords
      .filter((k: any) => typeof k === 'string' && k.trim())
      .slice(0, 20)
      .map((k: string) => k.trim().toLowerCase());
  }

  if (body.seo_description !== undefined) {
    update.seo_description = typeof body.seo_description === 'string'
      ? body.seo_description.trim().slice(0, 160) || null
      : null;
  }

  if (!Object.keys(update).length) return err('Aucune donnée valide', 400);

  const { data, error } = await sb
    .from('profiles')
    .update(update)
    .eq('id', profile.id)
    .select('seo_keywords, seo_description')
    .single();

  if (error) return err(error.message, 500);
  return ok(data);
};