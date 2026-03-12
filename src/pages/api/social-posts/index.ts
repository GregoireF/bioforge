// src/pages/api/social-posts/index.ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const ok  = (d: unknown, s = 200) => new Response(JSON.stringify({ success: true, data: d }), { status: s, headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { data } = await sb.from('social_posts').select('*').eq('profile_id', auth.data.profile.id).order('created_at', { ascending: false }).limit(50);
  return ok(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const plan = auth.data.planLimits?.plan ?? 'free';
  if (plan === 'free') return err('Creator requis', 403);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const { content, platforms, status, scheduled_at, ai_generated, hashtags, published_at } = body;
  if (!content?.trim()) return err('Contenu requis', 400);

  const { data, error } = await sb.from('social_posts').insert({
    profile_id:   auth.data.profile.id,
    content,
    platforms:    Array.isArray(platforms) ? platforms : [],
    status:       ['draft','scheduled','published'].includes(status) ? status : 'draft',
    scheduled_at: scheduled_at ?? null,
    published_at: published_at ?? null,
    ai_generated: !!ai_generated,
    hashtags:     Array.isArray(hashtags) ? hashtags : [],
  }).select().single();

  if (error) return err(error.message, 500);
  return ok(data, 201);
};