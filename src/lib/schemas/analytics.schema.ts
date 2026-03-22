// src/lib/schemas/analytics.schema.ts
import { z } from 'zod'
import { ANALYTICS_DAYS_STRICT, ANALYTICS_DAYS_MAX } from '@/lib/shared/constants'

const utmField = z.string().max(100).nullable().optional()

export const clickSchema = z.object({
  block_id:     z.string().uuid(),
  referrer:     z.string().max(500).nullable().optional(),
  utm_source:   utmField,
  utm_medium:   utmField,
  utm_campaign: utmField,
})

export const viewSchema = z.object({
  profile_id:   z.string().uuid(),
  referrer:     z.string().max(500).nullable().optional(),
  utm_source:   utmField,
  utm_medium:   utmField,
  utm_campaign: utmField,
  utm_content:  utmField,
  utm_term:     utmField,
})

// 7 / 30 / 90 — dashboard analytics (summary, full analytics)
export const analyticsDaysStrictSchema = z.string().optional()
  .transform(v => parseInt(v ?? '7', 10))
  .pipe(z.number().refine(
    n => (ANALYTICS_DAYS_STRICT as readonly number[]).includes(n),
    { message: `days doit être ${ANALYTICS_DAYS_STRICT.join(', ')}` }
  ))

// 1–180 — stats/index.ts (usage interne dashboard)
export const analyticsDaysFullSchema = z.string().optional()
  .transform(v => parseInt(v ?? '7', 10))
  .pipe(z.number().min(1).max(ANALYTICS_DAYS_MAX, { message: `days max ${ANALYTICS_DAYS_MAX}` }))

export type ClickInput = z.infer<typeof clickSchema>
export type ViewInput  = z.infer<typeof viewSchema>