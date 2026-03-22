import { UAParser } from 'ua-parser-js'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GeoResult {
  country:    string | null
  city:       string | null
  is_vpn:     boolean
  is_hosting: boolean
}

export interface UAResult {
  browser:          string | null
  os:               string | null
  device_type:      'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
  inferredReferrer: string | null
}

export interface BotInfo {
  isBot:   boolean
  botName: string | null
}

// ─── IP ───────────────────────────────────────────────────────────────────────
export function getIP(request: Request): string {
  const headers = request.headers
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-forwarded-for')?.split(',').map(ip => ip.trim()).find(ip => ip && ip !== 'unknown'),
    headers.get('x-real-ip'),
  ]
  for (const ip of candidates) {
    if (ip) return normalizeIP(ip)
  }
  return '0.0.0.0'
}

function normalizeIP(ip: string): string {
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}

function anonymizeIP(ip: string): string {
  if (ip.includes('.')) {
    const parts = ip.split('.')
    parts[3] = '0'
    return parts.join('.')
  }
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::'
  return ip
}

function normalizeUA(ua?: string): string {
  if (!ua) return ''
  const lower = ua.toLowerCase()
  if (lower.includes('chrome'))  return 'chrome'
  if (lower.includes('firefox')) return 'firefox'
  if (lower.includes('safari'))  return 'safari'
  if (lower.includes('edge'))    return 'edge'
  return 'other'
}

export async function hashIP(ip?: string, userAgent?: string): Promise<string> {
  const secret  = import.meta.env.ANALYTICS_SECRET ?? 'bioforge-analytics-secret'
  const day     = new Date().toISOString().slice(0, 10)
  const payload = `${anonymizeIP(ip ?? '0.0.0.0')}|${normalizeUA(userAgent)}|${day}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

// ─── Bot Detection ────────────────────────────────────────────────────────────
const NAMED_BOTS: { re: RegExp; name: string }[] = [
  { re: /Googlebot(?:-Image|-Video|-News)?/i, name: 'Googlebot'       },
  { re: /Bingbot/i,                           name: 'Bingbot'         },
  { re: /Baiduspider/i,                       name: 'Baiduspider'     },
  { re: /YandexBot/i,                         name: 'YandexBot'       },
  { re: /DuckDuckBot/i,                       name: 'DuckDuckBot'     },
  { re: /Slurp/i,                             name: 'Yahoo Slurp'     },
  { re: /GPTBot/i,                            name: 'GPTBot'          },
  { re: /ChatGPT-User/i,                      name: 'ChatGPT'         },
  { re: /ClaudeBot/i,                         name: 'ClaudeBot'       },
  { re: /anthropic-ai/i,                      name: 'Anthropic'       },
  { re: /PerplexityBot/i,                     name: 'PerplexityBot'   },
  { re: /cohere-ai/i,                         name: 'CohereBot'       },
  { re: /Applebot/i,                          name: 'Applebot'        },
  { re: /Twitterbot/i,                        name: 'Twitterbot'      },
  { re: /facebookexternalhit/i,               name: 'FacebookBot'     },
  { re: /LinkedInBot/i,                       name: 'LinkedInBot'     },
  { re: /TelegramBot/i,                       name: 'TelegramBot'     },
  { re: /WhatsApp\/\d/i,                      name: 'WhatsAppBot'     },
  { re: /Discordbot/i,                        name: 'Discordbot'      },
  { re: /Slackbot/i,                          name: 'Slackbot'        },
  { re: /ia_archiver|Wayback/i,               name: 'WaybackMachine'  },
  { re: /SemrushBot/i,                        name: 'SemrushBot'      },
  { re: /AhrefsBot/i,                         name: 'AhrefsBot'       },
  { re: /MJ12bot/i,                           name: 'Majestic'        },
  { re: /DotBot/i,                            name: 'OpenSiteExplorer'},
  { re: /PageSpeed|Lighthouse/i,              name: 'PageSpeed'       },
  { re: /HeadlessChrome/i,                    name: 'HeadlessChrome'  },
  { re: /PhantomJS/i,                         name: 'PhantomJS'       },
  { re: /Puppeteer/i,                         name: 'Puppeteer'       },
  { re: /Prerender/i,                         name: 'Prerender'       },
  { re: /wget|curl|python-requests|Go-http/i, name: 'Script/CLI'      },
  { re: /crawler|spider|scraper|archiver/i,   name: 'Generic Crawler' },
]

export function detectBot(ua: string): BotInfo {
  for (const { re, name } of NAMED_BOTS) {
    if (re.test(ua)) return { isBot: true, botName: name }
  }
  return { isBot: false, botName: null }
}

// ─── UA Parsing ───────────────────────────────────────────────────────────────
const IN_APP_BROWSERS: { re: RegExp; domain: string; label: string }[] = [
  { re: /Musical_ly|TikTok|Bytedance/i,     domain: 'tiktok.com',    label: 'TikTok'    },
  { re: /Instagram/i,                        domain: 'instagram.com', label: 'Instagram' },
  { re: /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i,      domain: 'facebook.com',  label: 'Facebook'  },
  { re: /Snapchat/i,                         domain: 'snapchat.com',  label: 'Snapchat'  },
  { re: /Twitter(?:Android|iPhone)|twttr/i,  domain: 'twitter.com',   label: 'X/Twitter' },
  { re: /LinkedInApp/i,                      domain: 'linkedin.com',  label: 'LinkedIn'  },
  { re: /Pinterest/i,                        domain: 'pinterest.com', label: 'Pinterest' },
  { re: /Line\/|NAVER|KakaoTalk/i,           domain: 'line.me',       label: 'Line'      },
]

export function parseUA(ua: string): UAResult {
  const parser = new UAParser(ua).getResult()
  const dt     = parser.device.type

  let browser:          string | null = parser.browser.name || null
  let inferredReferrer: string | null = null

  for (const { re, domain, label } of IN_APP_BROWSERS) {
    if (re.test(ua)) {
      browser          = `${label} in-app`
      inferredReferrer = domain
      break
    }
  }

  return {
    browser,
    os: parser.os.name || null,
    device_type: dt === 'mobile' ? 'mobile' : dt === 'tablet' ? 'tablet' : 'desktop',
    inferredReferrer,
  }
}

// ─── GeoIP ────────────────────────────────────────────────────────────────────
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd)/

export async function resolveGeoIP(ip: string): Promise<GeoResult> {
  const empty: GeoResult = { country: null, city: null, is_vpn: false, is_hosting: false }

  if (!ip || ip === '0.0.0.0' || PRIVATE_IP_RE.test(ip)) return empty

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,city,proxy,hosting`,
      { signal: controller.signal }
    )
    clearTimeout(timer)

    if (!res.ok) return empty

    const data = await res.json()
    if (data.status !== 'success') return empty

    return {
      country:    data.countryCode || null,
      city:       data.city        || null,
      is_vpn:     Boolean(data.proxy),
      is_hosting: Boolean(data.hosting),
    }
  } catch {
    return empty
  }
}

// ─── Referrer ─────────────────────────────────────────────────────────────────
export function cleanReferrer(ref: string | null | undefined): { domain: string | null; fullUrl: string | null } {
  if (!ref?.trim()) return { domain: null, fullUrl: null }
  try {
    const url = new URL(ref)
    return { domain: url.hostname.replace(/^www\./, '').toLowerCase(), fullUrl: ref.slice(0, 500) }
  } catch {
    return { domain: null, fullUrl: ref.slice(0, 500) }
  }
}

export function cleanUtm(val: string | null | undefined): string | null {
  if (!val?.trim()) return null
  return val.trim().slice(0, 100)
}