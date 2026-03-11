// src/pages/api/blocks/[id].ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { success, error } from '@/lib/core/http';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// ---------------- SUPABASE SERVER CLIENT ----------------
const supabaseServer = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Enum central — en sync avec index.ts, blocks.astro, [username].astro ──
const BLOCK_TYPES = [
  'link', 'heading', 'spacer', 'image', 'video', 'social',
  'countdown', 'schedule', 'donation', 'embed',
  'text', 'banner', 'product', 'poll', 'twitch_live',
  'newsletter', 'vcard', 'merch_grid',
] as const

// ---------------- VALIDATION ----------------
const updateBlockSchema = z.object({
  type:      z.enum(BLOCK_TYPES).optional(),
  // FIX : .min(1) retiré — les titres vides ("") et null sont valides (spacer, twitch_live…)
  title:     z.string().max(100).nullable().optional(),
  config:    z.record(z.string(), z.unknown()).optional(),
  active:    z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  position:  z.number().int().min(0).optional(),
}).strip();

// ---------------- GET ----------------
export const GET: APIRoute = async (context) => {
  const authResult = await withAuth(context);
  if (!authResult.success || !authResult.data)
    return error(authResult.error || 'Unauthorized', authResult.statusCode || 401);

  const { profile } = authResult.data;
  const { id } = context.params;
  if (!id) return error('Missing block ID', 400);

  const { data, error: supaError } = await supabaseServer
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('profile_id', profile.id)
    .single();

  if (supaError) return error(supaError.message, 500);
  if (!data)     return error('Block not found', 404);

  return success(data);
};

// ---------------- PUT ----------------
export const PUT: APIRoute = async (context) => {
  if (!context.request.headers.get('content-type')?.includes('application/json'))
    return error('Invalid content type', 415);

  const authResult = await withAuth(context);
  if (!authResult.success || !authResult.data)
    return error(authResult.error || 'Unauthorized', authResult.statusCode || 401);

  const { profile } = authResult.data;
  const { id } = context.params;
  if (!id) return error('Missing block ID', 400);

  let body: unknown;
  try { body = await context.request.json(); }
  catch { return error('Invalid JSON', 400); }

  const parsed = updateBlockSchema.safeParse(body);
  if (!parsed.success)                       return error('Validation failed', 400, parsed.error.flatten());
  if (Object.keys(parsed.data).length === 0) return error('Empty update', 400);

  const { data, error: supaError } = await supabaseServer
    .from('blocks')
    .update(parsed.data)
    .eq('id', id)
    .eq('profile_id', profile.id)
    .select()
    .single();

  if (supaError) return error(supaError.message, 500);
  if (!data)     return error('Block not found', 404);

  return success(data);
};

// ---------------- DELETE ----------------
export const DELETE: APIRoute = async (context) => {
  const authResult = await withAuth(context);
  if (!authResult.success || !authResult.data)
    return error(authResult.error || 'Unauthorized', authResult.statusCode || 401);

  const { profile } = authResult.data;
  const { id } = context.params;
  if (!id) return error('Missing block ID', 400);

  const { error: supaError } = await supabaseServer
    .from('blocks')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id);

  if (supaError) return error(supaError.message, 500);

  return success({ deleted: true, id });
};