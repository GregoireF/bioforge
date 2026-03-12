// src/pages/s/[code].ts
// Public redirect — no auth
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ params, request }) => {
  const { code } = params;
  if (!code) return new Response(null, { status: 404 });

  const { data: link } = await sb
    .from('short_links')
    .select('id, destination, utm_source, utm_medium, utm_campaign, expires_at, is_active')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (!link) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lien introuvable</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0a;color:#fff;"><h1>🔗 Lien introuvable</h1><p>Ce lien n'existe pas ou a été désactivé.</p><a href="https://bioforge.click" style="color:#00ff9d;">← Retour à BioForge</a></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await sb.from('short_links').update({ is_active: false }).eq('id', link.id);
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lien expiré</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0a;color:#fff;"><h1>⏰ Lien expiré</h1><p>Ce lien n'est plus actif.</p><a href="https://bioforge.click" style="color:#00ff9d;">← Retour à BioForge</a></body></html>`,
      { status: 410, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Build destination URL with UTM params
  let destination = link.destination;
  try {
    const url = new URL(destination);
    if (link.utm_source)   url.searchParams.set('utm_source',   link.utm_source);
    if (link.utm_medium)   url.searchParams.set('utm_medium',   link.utm_medium);
    if (link.utm_campaign) url.searchParams.set('utm_campaign', link.utm_campaign);
    destination = url.toString();
  } catch {}

  // Increment clicks (fire & forget via RPC)
  sb.rpc('increment_link_clicks', { p_code: code }).then(() => {});

  // Log click
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const country = request.headers.get('x-vercel-ip-country') ?? null;
  const referrer = request.headers.get('referer') ?? null;

  sb.from('short_link_clicks').insert({
    link_id:  link.id,
    ip_hash:  ip ? await hashIp(ip) : null,
    country,
    referrer,
    ua: request.headers.get('user-agent')?.slice(0, 200) ?? null,
  }).then(() => {});

  return new Response(null, {
    status:  301,
    headers: { 'Location': destination, 'Cache-Control': 'no-cache, no-store' },
  });
};

async function hashIp(ip: string): Promise<string> {
  const salt = import.meta.env.ANALYTICS_SALT ?? 'bioforge-salt';
  const data = new TextEncoder().encode(ip + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 16);
}