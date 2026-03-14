// src/pages/api/feedback.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
 
const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);
 
export const POST: APIRoute = async ({ request, cookies }) => {
  const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, data: d }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const err = (m: string) => new Response(JSON.stringify({ success: false, error: m }), { status: 400, headers: { 'Content-Type': 'application/json' } });
 
  let body: any;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
 
  const score   = typeof body.score   === 'number' && body.score >= 1 && body.score <= 5 ? body.score : null;
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 400) : null;
  const source  = typeof body.source  === 'string' ? body.source.slice(0, 60) : 'unknown';
  const url     = typeof body.url     === 'string' ? body.url.slice(0, 200) : null;
 
  if (!score) return err('score must be 1-5');
 
  // Optionnel: récupérer l'user ID si connecté
  let userId: string | null = null;
  try {
    const { createServerClient } = await import('@supabase/ssr');
    // Pas critique — on continue même sans user_id
  } catch {}
 
  const { error } = await sb.from('feedback').insert({
    score,
    comment,
    source,
    url,
    user_id: userId,
    created_at: new Date().toISOString(),
  });
 
  if (error) {
    console.error('[feedback]', error.message);
    // Ne pas bloquer l'UX pour une erreur de feedback
  }
 
  return ok({ received: true });
};
 