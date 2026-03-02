// src/pages/api/blocks/[id].ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { success, error } from '@/lib/core/http';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// ---------------- SUPABASE SERVER CLIENT ----------------
const supabaseServer = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY // côté serveur
);

// ---------------- VALIDATION ----------------
const updateBlockSchema = z.object({
  type: z.enum(['link', 'heading', 'spacer', 'image', 'video', 'social']).optional(),
  title: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
}).strip();

// ---------------- GET BLOCK ----------------
export const GET: APIRoute = async (context) => {
  const { params, request } = context;

  const authResult = await withAuth(context);
  if (!authResult.success || !authResult.data) return error(authResult.error || 'Unauthorized', authResult.statusCode || 401);

  const { profile } = authResult.data;
  const { id } = params;
  if (!id) return error('Missing block ID', 400);

  const { data, error: supaError } = await supabaseServer
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('profile_id', profile.id)
    .single(); // force un seul objet

  if (supaError) return error(supaError.message, 500);
  if (!data) return error('Block not found', 404);

  return success(data);
};

// ---------------- UPDATE BLOCK ----------------
export const PUT: APIRoute = async (context) => {
  const { params, request } = context;

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return error('Invalid content type', 415);
  }

  const authResult = await withAuth(context);
  if (!authResult.success || !authResult.data) return error(authResult.error || 'Unauthorized', authResult.statusCode || 401);

  const { profile } = authResult.data;
  const { id } = params;
  if (!id) return error('Missing block ID', 400);

  const body = await request.json();
  const parsed = updateBlockSchema.safeParse(body);
  if (!parsed.success) return error('Validation failed', 400, parsed.error.flatten());
  if (Object.keys(parsed.data).length === 0) return error('Empty update', 400);

  const { data, error: supaError } = await supabaseServer
    .from('blocks')
    .update(parsed.data)
    .eq('id', id)
    .eq('profile_id', profile.id)
    .select()
    .single();

  if (supaError) return error(supaError.message, 500);
  if (!data) return error('Block not found', 404);

  return success(data);
};

// ---------------- DELETE BLOCK ----------------
export const DELETE: APIRoute = async (context) => {
  const { params } = context;

  const authResult = await withAuth(context);
  if (!authResult.success || !authResult.data) return error(authResult.error || 'Unauthorized', authResult.statusCode || 401);

  const { profile } = authResult.data;
  const { id } = params;
  if (!id) return error('Missing block ID', 400);

  // Soft delete pour respecter RLS
  const { data, error: supaError } = await supabaseServer
    .from('blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('profile_id', profile.id)
    .select()
    .single();

  if (supaError) return error(supaError.message, 500);
  if (!data) return error('Block not found', 404);

  return success({ message: 'Deleted successfully', block: data });
};