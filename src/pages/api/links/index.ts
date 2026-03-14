// src/pages/api/links/index.ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);
const ok  = (d: unknown, s = 200) => new Response(JSON.stringify({ success: true, data: d }), { status: s, headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

function randomCode(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len).padStart(len, '0');
}

export const GET: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;

  const { data } = await sb.from('short_links').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false });
  return ok(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  if (!ctx.request.headers.get('content-type')?.includes('application/json')) return err('Invalid content type', 415);
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile, planLimits } = auth.data;

  const _pl    = planLimits as any;
  const plan   = _pl?.plan ?? (profile as any)?.plan ?? 'free';
  const PAID   = ['Creator', 'Pro', 'Enterprise'];
  const PROS   = ['Creator', 'Pro', 'Enterprise' ];
  if (!PAID.includes(plan)) return err('Plan Creator requis pour le link shortener', 403);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const { destination, code, title, expires_at, utm_source, utm_medium, utm_campaign } = body;

  if (!destination || typeof destination !== 'string' || !destination.startsWith('http'))
    return err('URL de destination invalide', 400);

  // Validate or generate code
  let finalCode = (code ?? '').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 20);
  if (!finalCode) finalCode = randomCode(6);

  // Check uniqueness
  const { data: existing } = await sb.from('short_links').select('id').eq('code', finalCode).single();
  if (existing) return err(`Le code "${finalCode}" est déjà pris`, 409);

  // Check plan limit
  if (!PROS.includes(plan)) {  // cap at creator tier (not pro/enterprise)
    const { count } = await sb.from('short_links').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id);
    if ((count ?? 0) >= 50) return err('Limite de 50 liens atteinte sur Creator', 403);
  }

  const { data, error } = await sb.from('short_links').insert({
    profile_id: profile.id,
    code: finalCode,
    destination,
    title: title || null,
    expires_at: expires_at || null,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
  }).select().single();

  if (error) return err(error.message, 500);
  return ok(data, 201);
};