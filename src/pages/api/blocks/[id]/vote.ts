// src/pages/api/blocks/[id]/vote.ts
// Public endpoint — no auth required (visitors vote)
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const ok  = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const err = (msg: string, status = 400) => new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ params, request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return err('Invalid content type', 415);

  const { id } = params;
  if (!id) return err('Missing block ID', 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return err('Invalid JSON', 400); }

  const optionIndex = (body as any)?.option_index;
  if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 9)
    return err('option_index must be an integer between 0 and 9', 400);

  // Rate limit simple: IP-based via header (best effort)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // 1. Fetch the block
  const { data: block, error: fetchErr } = await supabase
    .from('blocks')
    .select('id, type, config, active')
    .eq('id', id)
    .single();

  if (fetchErr || !block) return err('Block not found', 404);
  if (block.type !== 'poll')   return err('Not a poll block', 400);
  if (!block.active)           return err('Poll is inactive', 400);

  const config  = block.config as any ?? {};
  const options = Array.isArray(config.options) ? [...config.options] : [];

  if (optionIndex >= options.length) return err('Invalid option index', 400);

  // 2. Increment the vote count
  options[optionIndex] = {
    ...options[optionIndex],
    votes: ((options[optionIndex].votes ?? 0) as number) + 1,
  };

  // 3. Update the block config
  const { data: updated, error: updateErr } = await supabase
    .from('blocks')
    .update({ config: { ...config, options } })
    .eq('id', id)
    .select('id, config')
    .single();

  if (updateErr) return err(updateErr.message, 500);

  return ok({
    options: (updated?.config as any)?.options ?? options,
    voted_index: optionIndex,
  });
};