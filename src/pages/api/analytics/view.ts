// src/pages/api/analytics/view.ts
import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { UAParser } from 'ua-parser-js'
import { createHash } from 'node:crypto'

// ── Supabase service client ──────────────────────────────────
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Validation ───────────────────────────────────────────────
const schema = z.object({
  profile_id:   z.string().uuid(),
  referrer:     z.string().max(500).nullable().optional(),
  utm_source:   z.string().max(100).nullable().optional(),
  utm_medium:   z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
  utm_content:  z.string().max(100).nullable().optional(),
  utm_term:     z.string().max(100).nullable().optional(),
})

// ── Helpers ──────────────────────────────────────────────────

/** Hash l'IP avec un sel — jamais l'IP brute en base */
function hashIP(ip: string): string {
  const salt = import.meta.env.ANALYTICS_SALT || 'bioforge-analytics-salt'
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 16)
}

/** IP réelle depuis les headers Cloudflare / proxy */
function getIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    request.headers.get('X-Real-IP') ||
    '0.0.0.0'
  )
}

/** Filtre les bots connus avant d'insérer en base */
function isBot(ua: string): boolean {
  return /bot|crawl|spider|headless|lighthouse|pagespeed|prerender|scrapy|wget|curl/i.test(ua)
}

/** Parse User-Agent → browser, os, device_type */
function parseUA(ua: string) {
  const r = new UAParser(ua).getResult()
  const dt = r.device.type // 'mobile' | 'tablet' | undefined (= desktop)
  return {
    browser:     r.browser.name || null,
    os:          r.os.name || null,
    device_type: (dt === 'mobile' ? 'mobile' : dt === 'tablet' ? 'tablet' : 'desktop') as string,
  }
}

/** Extrait le domaine propre du referrer (ex: instagram.com) */
function cleanReferrer(ref: string | null | undefined): { domain: string | null; full: string | null } {
  if (!ref) return { domain: null, full: null }
  try {
    const url = new URL(ref)
    return {
      domain: url.hostname.replace(/^www\./, ''),
      full:   ref.slice(0, 500),
    }
  } catch {
    return { domain: null, full: ref.slice(0, 500) }
  }
}

// ── Handler ──────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  // 1. Content-type
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  // 2. Origin guard (évite les inflations depuis des domaines externes en prod)
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  if (import.meta.env.PROD && !origin.includes('bioforge.click'))
    return new Response(null, { status: 403 })

  // 3. Parse body
  let body: unknown
  try { body = await request.json() } catch { return new Response(null, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })

  const d = parsed.data

  // 4. UA — ignorer les bots
  const ua = request.headers.get('user-agent') || ''
  if (isBot(ua))
    return new Response(JSON.stringify({ ok: true, skipped: 'bot' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  // 5. IP & géo (headers Cloudflare)
  const ip      = getIP(request)
  const ipHash  = hashIP(ip)
  const rawCountry = request.headers.get('CF-IPCountry') // 'XX' = inconnu
  const country = rawCountry && rawCountry !== 'XX' ? rawCountry : null
  const city    = request.headers.get('CF-IPCity') || null

  // 6. Device / Browser / OS
  const { browser, os, device_type } = parseUA(ua)

  // 7. Referrer
  const { domain: referrer, full: referrerFull } = cleanReferrer(d.referrer)

  // 8. Insert raw event
  const { error: insertError } = await supabase
    .from('profile_views')
    .insert({
      profile_id:    d.profile_id,
      ip_hash:       ipHash,
      country,
      city,
      device_type,
      os,
      browser,
      referrer,
      referrer_full: referrerFull,
      utm_source:    d.utm_source   || null,
      utm_medium:    d.utm_medium   || null,
      utm_campaign:  d.utm_campaign || null,
      utm_content:   d.utm_content  || null,
      utm_term:      d.utm_term     || null,
    })

  if (insertError) {
    console.error('[analytics/view] insert error:', insertError.message)
    // On retourne quand même 200 — ne pas bloquer le visiteur pour une erreur d'analytics
    return new Response(JSON.stringify({ ok: false }), { status: 200 })
  }

  // 9. Incrément compteur journalier (upsert atomique via RPC)
  const today = new Date().toISOString().split('T')[0]
  await supabase.rpc('increment_profile_views', {
    p_profile_id: d.profile_id,
    p_date:       today,
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}