// src/pages/api/integrations/[provider].ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);
const ok  = (d: unknown, s = 200) => new Response(JSON.stringify({ success: true, data: d }), { status: s, headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

const VALID_PROVIDERS = ['instagram','tiktok','youtube','twitch','twitter','discord','snapchat','pinterest','mailchimp','klaviyo','convertkit','beehiiv','brevo','googlesheets','canva','spotify','soundcloud','stripe','throne','kofi','patreon','googleanalytics','googlesearchconsole'];

// Connect integration (manual API key or after OAuth callback)
export const POST: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile, planLimits } = auth.data;
  const { provider } = ctx.params;

  if (!VALID_PROVIDERS.includes(provider ?? '')) return err('Provider invalide', 400);

  const _pl = planLimits as any;
  const plan = _pl?.plan ?? (profile as any)?.plan ?? 'Free';
  const PAID = ['Creator', 'Pro', 'Enterprise' ];
  const PROS = ['Pro', 'Enterprise' ];
  // Check plan limits for premium integrations
  const CREATOR_PROVIDERS = ['instagram','tiktok','youtube','twitch','twitter','discord','pinterest','mailchimp','klaviyo','convertkit','brevo','googlesheets','canva','throne','patreon'];
  const PRO_PROVIDERS     = ['snapchat','stripe','beehiiv','googleanalytics','googlesearchconsole'];

  if (PRO_PROVIDERS.includes(provider!) && !PROS.includes(plan))
    return err('Plan Pro requis pour cette intégration', 403);
  if (CREATOR_PROVIDERS.includes(provider!) && !PAID.includes(plan))
    return err('Plan Creator requis pour cette intégration', 403);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const { api_key, username } = body;
  if (!username) return err('Username requis', 400);

  const { data, error } = await sb.from('integrations').upsert({
    profile_id:       profile.id,
    provider:         provider!,
    status:           'connected',
    provider_username: username,
    access_token:     api_key ?? null,
    connected_at:     new Date().toISOString(),
  }, { onConflict: 'profile_id,provider' }).select().single();

  if (error) return err(error.message, 500);
  return ok(data, 201);
};

// Update integration (auto_reply toggle, config…)
export const PATCH: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile, planLimits } = auth.data;
  const { provider } = ctx.params;

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const allowed: any = {};
  if (typeof body.auto_reply_enabled === 'boolean') {
    // Auto-reply requires Pro
    if (body.auto_reply_enabled && !PROS.includes(plan))
      return err('Plan Pro requis pour l\'auto-reply', 403);
    allowed.auto_reply_enabled = body.auto_reply_enabled;
  }
  if (body.auto_reply_config && typeof body.auto_reply_config === 'object') {
    allowed.auto_reply_config = body.auto_reply_config;
  }
  if (!Object.keys(allowed).length) return err('No valid fields', 400);

  const { data, error } = await sb.from('integrations')
    .update(allowed)
    .eq('profile_id', profile.id)
    .eq('provider', provider!)
    .select().single();

  if (error) return err(error.message, 500);
  return ok(data);
};

// Disconnect integration
export const DELETE: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;
  const { provider } = ctx.params;

  const { error } = await sb.from('integrations')
    .delete()
    .eq('profile_id', profile.id)
    .eq('provider', provider!);

  if (error) return err(error.message, 500);
  return ok({ disconnected: true, provider });
};