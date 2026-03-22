// src/lib/schemas/profile.schema.ts
import { z } from 'zod'
import { VALID_USAGES, VALID_SOURCES, PRESET_THEMES } from '@/lib/shared/constants'

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/

export const usernameSchema = z
  .string()
  .regex(USERNAME_RE, 'Format invalide : 3-24 chars, a-z0-9_ uniquement')
  .transform(v => v.toLowerCase().trim())

export const profileUpdateSchema = z.object({
  display_name: z.string().max(60).nullable().optional(),
  bio:          z.string().max(320).nullable().optional(),
  theme:        z.record(z.string(), z.unknown()).optional(),
}).strict()

export const onboardingFeedbackSchema = z.object({
  usages:  z.array(z.enum(VALID_USAGES)).max(6).optional(),
  source:  z.enum(VALID_SOURCES).optional(),
  nps:     z.number().int().min(0).max(10).optional(),
  comment: z.string().max(500).optional(),
}).strict()

export const onboardingSchema = z.object({
  username:     usernameSchema,
  display_name: z.string().max(60).optional(),
  bio:          z.string().max(320).optional(),
  preset:       z.enum(PRESET_THEMES).optional(),
  feedback:     onboardingFeedbackSchema.optional(),
}).strict()

export const seoSchema = z.object({
  seo_keywords:    z.array(z.string().min(1).max(50)).max(20).optional(),
  seo_description: z.string().max(160).nullable().optional(),
}).strict()

export type ProfileUpdateInput    = z.infer<typeof profileUpdateSchema>
export type OnboardingInput       = z.infer<typeof onboardingSchema>
export type OnboardingFeedback    = z.infer<typeof onboardingFeedbackSchema>
export type SeoInput              = z.infer<typeof seoSchema>