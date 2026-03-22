// src/lib/modules/analytics/pipeline.ts
// Logique commune click.ts + view.ts — IP, UA, GeoIP, UTM, bot check
import {
  getIP, hashIP, detectBot, parseUA,
  resolveGeoIP, cleanReferrer, cleanUtm,
} from '@/lib/analytics/helpers'

export interface UtmParams {
  utm_source?:   string | null
  utm_medium?:   string | null
  utm_campaign?: string | null
  utm_content?:  string | null
  utm_term?:     string | null
  referrer?:     string | null
}

export interface AnalyticsPayload {
  isBot:       boolean
  botName:     string | null
  ipHash:      string
  ip:          string
  browser:     string | null
  os:          string | null
  device_type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
  referrer:    string | null
  referrer_full: string | null
  country:     string | null
  city:        string | null
  is_vpn:      boolean
  is_hosting:  boolean
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  utm_content:  string | null
  utm_term:     string | null
}

export async function buildAnalyticsPayload(
  request: Request,
  utm: UtmParams = {}
): Promise<AnalyticsPayload> {
  const ua = request.headers.get('user-agent') ?? ''
  const { isBot, botName } = detectBot(ua)

  const ip     = getIP(request)
  const ipHash = await hashIP(ip)

  const { browser, os, device_type, inferredReferrer } = parseUA(ua)
  const { domain: referrerDomain, fullUrl: referrerFull } = cleanReferrer(utm.referrer)
  const referrer = referrerDomain || inferredReferrer

  // GeoIP — fail-safe, timeout 2s
  const { country, city, is_vpn, is_hosting } = isBot
    ? { country: null, city: null, is_vpn: false, is_hosting: true }
    : await resolveGeoIP(ip)

  return {
    isBot,
    botName,
    ipHash,
    ip,
    browser,
    os,
    device_type,
    referrer,
    referrer_full: referrerFull,
    country,
    city,
    is_vpn,
    is_hosting,
    utm_source:   cleanUtm(utm.utm_source),
    utm_medium:   cleanUtm(utm.utm_medium),
    utm_campaign: cleanUtm(utm.utm_campaign),
    utm_content:  cleanUtm(utm.utm_content),
    utm_term:     cleanUtm(utm.utm_term),
  }
}