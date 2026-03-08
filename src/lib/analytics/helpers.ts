// src/lib/analytics/helpers.ts
import { createHash } from 'node:crypto'
import { UAParser } from 'ua-parser-js'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface GeoResult {
  country:    string | null
  city:       string | null
  is_vpn:     boolean  // proxy / Tor / VPN détecté
  is_hosting: boolean  // datacenter / bot hosting IP
}

export interface UAResult {
  browser:          string | null
  os:               string | null
  device_type:      'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
  inferredReferrer: string | null  // tiktok.com, instagram.com… si in-app browser
}

export interface BotInfo {
  isBot:   boolean
  botName: string | null  // 'Googlebot', 'GPTBot'… ou null si humain
}

// ─────────────────────────────────────────────────────────────
// IP
// ─────────────────────────────────────────────────────────────

/** IP réelle — Vercel injecte x-forwarded-for automatiquement */
export function getIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'
  )
}

/** Hash anonymisé SHA-256 tronqué à 16 chars — jamais l'IP brute en base */
export function hashIP(ip: string): string {
  const salt = (import.meta.env?.ANALYTICS_SALT ?? process.env?.ANALYTICS_SALT ?? 'bioforge-analytics-v1')
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 16)
}

// ─────────────────────────────────────────────────────────────
// BOT DETECTION
// ─────────────────────────────────────────────────────────────

/** Bots nommés — ordre : plus spécifique en premier */
const NAMED_BOTS: { re: RegExp; name: string }[] = [
  { re: /Googlebot(?:-Image|-Video|-News)?/i,  name: 'Googlebot'      },
  { re: /Bingbot/i,                            name: 'Bingbot'        },
  { re: /Baiduspider/i,                        name: 'Baiduspider'    },
  { re: /YandexBot/i,                          name: 'YandexBot'      },
  { re: /DuckDuckBot/i,                        name: 'DuckDuckBot'    },
  { re: /Slurp/i,                              name: 'Yahoo Slurp'    },
  { re: /GPTBot/i,                             name: 'GPTBot'         },
  { re: /ChatGPT-User/i,                       name: 'ChatGPT'        },
  { re: /ClaudeBot/i,                          name: 'ClaudeBot'      },
  { re: /anthropic-ai/i,                       name: 'Anthropic'      },
  { re: /PerplexityBot/i,                      name: 'PerplexityBot'  },
  { re: /cohere-ai/i,                          name: 'CohereBot'      },
  { re: /Applebot/i,                           name: 'Applebot'       },
  { re: /Twitterbot/i,                         name: 'Twitterbot'     },
  { re: /facebookexternalhit/i,                name: 'FacebookBot'    },
  { re: /LinkedInBot/i,                        name: 'LinkedInBot'    },
  { re: /TelegramBot/i,                        name: 'TelegramBot'    },
  { re: /WhatsApp\/\d/i,                       name: 'WhatsAppBot'    },
  { re: /Discordbot/i,                         name: 'Discordbot'     },
  { re: /Slackbot/i,                           name: 'Slackbot'       },
  { re: /ia_archiver|Wayback/i,                name: 'WaybackMachine' },
  { re: /SemrushBot/i,                         name: 'SemrushBot'     },
  { re: /AhrefsBot/i,                          name: 'AhrefsBot'      },
  { re: /MJ12bot/i,                            name: 'Majestic'       },
  { re: /DotBot/i,                             name: 'OpenSiteExplorer'},
  { re: /PageSpeed|Lighthouse/i,               name: 'PageSpeed'      },
  { re: /HeadlessChrome/i,                     name: 'HeadlessChrome' },
  { re: /PhantomJS/i,                          name: 'PhantomJS'      },
  { re: /Puppeteer/i,                          name: 'Puppeteer'      },
  { re: /Prerender/i,                          name: 'Prerender'      },
  { re: /wget|curl|python-requests|Go-http/i,  name: 'Script/CLI'     },
  { re: /crawler|spider|scraper|archiver/i,    name: 'Generic Crawler'},
]

export function detectBot(ua: string): BotInfo {
  for (const { re, name } of NAMED_BOTS) {
    if (re.test(ua)) return { isBot: true, botName: name }
  }
  return { isBot: false, botName: null }
}

// ─────────────────────────────────────────────────────────────
// IN-APP BROWSER / UA PARSING
// ─────────────────────────────────────────────────────────────

const IN_APP_BROWSERS: { re: RegExp; domain: string; label: string }[] = [
  { re: /Musical_ly|TikTok|Bytedance/i,       domain: 'tiktok.com',    label: 'TikTok'    },
  { re: /Instagram/i,                          domain: 'instagram.com', label: 'Instagram' },
  { re: /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i,        domain: 'facebook.com',  label: 'Facebook'  },
  { re: /Snapchat/i,                           domain: 'snapchat.com',  label: 'Snapchat'  },
  { re: /Twitter(?:Android|iPhone)|twttr/i,    domain: 'twitter.com',   label: 'X/Twitter' },
  { re: /LinkedInApp/i,                        domain: 'linkedin.com',  label: 'LinkedIn'  },
  { re: /Pinterest/i,                          domain: 'pinterest.com', label: 'Pinterest' },
  { re: /Line\/|NAVER|KakaoTalk/i,             domain: 'line.me',       label: 'Line'      },
]

export function parseUA(ua: string): UAResult {
  const parser = new UAParser(ua).getResult()
  const dt     = parser.device.type // 'mobile' | 'tablet' | undefined

  let browser:          string | null = parser.browser.name || null
  let inferredReferrer: string | null = null

  for (const { re, domain, label } of IN_APP_BROWSERS) {
    if (re.test(ua)) {
      browser          = `${label} in-app`
      inferredReferrer = domain
      break
    }
  }

  const device_type: UAResult['device_type'] =
    dt === 'mobile'  ? 'mobile'  :
    dt === 'tablet'  ? 'tablet'  :
    'desktop'

  return {
    browser,
    os:          parser.os.name || null,
    device_type,
    inferredReferrer,
  }
}

// ─────────────────────────────────────────────────────────────
// GEOIP — ip-api.com
// ─────────────────────────────────────────────────────────────
// Gratuit, 45 req/min, HTTP uniquement (appel serveur uniquement).
// Champs : countryCode, city, proxy (VPN/Tor), hosting (datacenter).
// En cas d'erreur ou rate-limit → retourne nulls sans bloquer la requête.

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd)/

export async function resolveGeoIP(ip: string): Promise<GeoResult> {
  // Pas de lookup pour les IPs privées (local dev, intranet)
  if (!ip || ip === '0.0.0.0' || PRIVATE_IP_RE.test(ip)) {
    return { country: null, city: null, is_vpn: false, is_hosting: false }
  }

  try {
    // Timeout 2s — ne doit jamais bloquer la réponse HTTP principale
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(
      // Note : ip-api.com requiert HTTP sur le plan gratuit.
      // Vercel serverless peut faire des appels HTTP sortants sans restriction.
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,city,proxy,hosting`,
      { signal: controller.signal }
    )
    clearTimeout(timer)

    if (!res.ok) return { country: null, city: null, is_vpn: false, is_hosting: false }

    const data = await res.json()

    if (data.status !== 'success') {
      return { country: null, city: null, is_vpn: false, is_hosting: false }
    }

    return {
      country:    data.countryCode || null,
      city:       data.city        || null,
      is_vpn:     Boolean(data.proxy),    // true = VPN / Tor / proxy
      is_hosting: Boolean(data.hosting),  // true = datacenter / bot hosting
    }
  } catch {
    // Timeout, rate-limit (429), réseau — silencieux
    return { country: null, city: null, is_vpn: false, is_hosting: false }
  }
}

// ─────────────────────────────────────────────────────────────
// REFERRER
// ─────────────────────────────────────────────────────────────

export function cleanReferrer(ref: string | null | undefined): {
  domain:   string | null
  fullUrl:  string | null
} {
  if (!ref || ref.trim() === '') return { domain: null, fullUrl: null }
  try {
    const url = new URL(ref)
    return {
      domain:  url.hostname.replace(/^www\./, '').toLowerCase(),
      fullUrl: ref.slice(0, 500),
    }
  } catch {
    return { domain: null, fullUrl: ref.slice(0, 500) }
  }
}

// ─────────────────────────────────────────────────────────────
// UTM — nettoie les valeurs vides → null
// ─────────────────────────────────────────────────────────────

export function cleanUtm(val: string | null | undefined): string | null {
  if (!val || val.trim() === '') return null
  return val.trim().slice(0, 100)
}