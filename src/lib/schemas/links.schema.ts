// src/lib/schemas/links.schema.ts
import { z } from 'zod'
import { LINK_CODE_RE } from '@/lib/shared/constants'

export const createLinkSchema = z.object({
  destination:  z.string().url({ message: 'URL de destination invalide' }).max(2000),
  code:         z.string().regex(LINK_CODE_RE, 'Code invalide (a-z0-9_- max 20 chars)')
                  .transform(v => v.toLowerCase())
                  .optional(),
  title:        z.string().max(100).nullable().optional(),
  expires_at:   z.string().datetime().nullable().optional(),
  utm_source:   z.string().max(100).nullable().optional(),
  utm_medium:   z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
}).strict()

export const updateLinkSchema = z.object({
  is_active:  z.boolean().optional(),
  title:      z.string().max(100).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
}).strict()

export type CreateLinkInput = z.infer<typeof createLinkSchema>
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>